# grvt-cli 구현 계획

> Layer 1: CLI 바이너리 — GRVT API 전체 기능을 터미널 명령어로 제공

---

## 1. 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 언어 | TypeScript | 공식 `@grvt/client` + `@grvt/sdk` 패키지 직접 활용 가능. EIP-712 서명(`ethers`, `@metamask/eth-sig-util`) 재사용 |
| CLI 프레임워크 | [Commander.js](https://github.com/tj/commander.js) | 서브커맨드 구조, 옵션 파싱, 자동 help 생성. 가장 성숙한 Node CLI 라이브러리 |
| 빌드/번들 | `tsup` (esbuild 기반) | 단일 JS 파일로 번들 → `pkg` 또는 `node --single-executable-application`으로 단일 바이너리 생성 가능 |
| 패키지 매니저 | npm | 공식 SDK가 npm 기반 |
| 출력 포맷 | JSON + Table (기본 table, `--output json` 시 JSON) | 사람 친화적 기본값 + 에이전트용 JSON |

---

## 2. 프로젝트 구조

```
grvt-cli/
├── src/
│   ├── index.ts                    # CLI 엔트리포인트 (Commander 설정)
│   ├── commands/
│   │   ├── auth.ts                 # auth login / auth status
│   │   ├── market.ts               # market ticker / orderbook / instruments / candles
│   │   ├── order.ts                # order create / cancel / cancel-all / list / get / history
│   │   ├── position.ts             # position list
│   │   ├── funding.ts              # funding rate / funding history
│   │   ├── account.ts              # account summary / sub-account summary
│   │   └── config.ts               # config set / config get / config list
│   ├── client/
│   │   ├── api-client.ts           # @grvt/sdk 래핑 — 인증, 쿠키 관리, 에러 핸들링
│   │   └── ws-client.ts            # WebSocket 래핑 (Phase 2)
│   ├── config/
│   │   ├── store.ts                # 설정 파일 읽기/쓰기 (~/.grvt-cli/config.json)
│   │   └── constants.ts            # 환경별 도메인, 기본값, Builder ID
│   ├── signing/
│   │   └── order-signer.ts         # EIP-712 주문 서명 (types.ts의 Order 타입 활용)
│   ├── output/
│   │   ├── formatter.ts            # JSON / Table 출력 분기
│   │   └── error.ts                # 행동 유도형 에러 메시지 (stderr)
│   └── utils/
│       └── helpers.ts              # 공통 유틸 (숫자 포맷, 시간 변환 등)
├── package.json
├── tsconfig.json
├── tsup.config.ts                  # 빌드 설정
└── PLAN.md
```

---

## 3. 명령어 체계 (Command Hierarchy)

### Phase 1 — MVP (핵심 트레이딩 루프)

```
grvt-cli config set --env testnet --api-key $KEY --api-secret $SECRET
grvt-cli config list

grvt-cli auth login                              # API 키로 세션 쿠키 획득
grvt-cli auth status                             # 현재 인증 상태 확인

grvt-cli market instruments [--kind perpetual]    # 상장 종목 목록
grvt-cli market ticker <instrument>               # 현재가/24h 변동
grvt-cli market orderbook <instrument> [--depth 10] # 오더북

grvt-cli order create \
    --instrument BTC_USDT_Perp \
    --side buy \
    --size 0.1 \
    --type limit \
    --price 65000 \
    [--reduce-only] \
    [--time-in-force GTC] \
    [--client-order-id myid1]                     # 주문 생성

grvt-cli order cancel --order-id <id>             # 단일 주문 취소
grvt-cli order cancel-all [--instrument BTC_USDT_Perp] # 전체 주문 취소
grvt-cli order get --order-id <id>                # 주문 상세 조회
grvt-cli order list [--instrument ...]            # 미체결 주문 목록
grvt-cli order history [--instrument ...]         # 주문 이력

grvt-cli position list                            # 포지션 조회

grvt-cli funding rate <instrument>                # 현재 펀딩비
grvt-cli funding history --instrument <inst>      # 펀딩비 이력

grvt-cli account summary                          # 펀딩 계정 요약
grvt-cli account sub-account --id <sub-id>        # 서브 계정 요약
```

### Phase 2 — 확장 (후속)

```
grvt-cli market candles <instrument> --interval 1h   # 캔들스틱
grvt-cli market trades <instrument>                  # 최근 체결
grvt-cli account leverage --instrument ... --value 10 # 레버리지 설정
grvt-cli account fill-history                        # 체결 이력
grvt-cli stream ticker <instrument>                  # WebSocket 실시간
grvt-cli stream orderbook <instrument>               # WebSocket 실시간
```

---

## 4. 핵심 구현 상세

### 4.1 인증 플로우

GRVT API 인증은 `@grvt/sdk`의 `GrvtBaseClient`가 이미 구현한 방식을 따른다:

```
1. grvt-cli config set --api-key ... --api-secret ...
   → ~/.grvt-cli/config.json에 저장 (api-secret은 암호화 고려)

2. grvt-cli auth login
   → POST https://edge.{domain}/auth/api_key/login
   → gravity 쿠키 + X-Grvt-Account-Id 수신
   → 세션 정보를 ~/.grvt-cli/session.json에 캐시 (TTL 관리)

3. 모든 인증 필요 요청
   → 세션 만료 확인 → 자동 갱신 → Cookie 헤더 포함
```

### 4.2 주문 서명 (EIP-712)

`@grvt/sdk`의 signing 모듈을 참조하여 주문 서명을 구현:

```typescript
// Order EIP-712 타입 (types.ts 참조)
Order = {
  primaryType: 'Order',
  types: {
    Order: [
      { name: 'subAccountID', type: 'uint64' },
      { name: 'isMarket', type: 'bool' },
      { name: 'timeInForce', type: 'uint8' },
      { name: 'postOnly', type: 'bool' },
      { name: 'reduceOnly', type: 'bool' },
      { name: 'legs', type: 'OrderLeg[]' },
      { name: 'nonce', type: 'uint32' },
      { name: 'expiration', type: 'int64' },
    ],
    OrderLeg: [
      { name: 'assetID', type: 'uint256' },
      { name: 'contractSize', type: 'uint64' },
      { name: 'limitPrice', type: 'uint64' },
      { name: 'isBuyingContract', type: 'bool' },
    ],
  }
}
```

서명 흐름:
1. CLI 옵션 → IOrder 객체 변환
2. `apiSecret`(프라이빗 키)로 EIP-712 서명 생성
3. `ISignature` (signer, r, s, v, expiration, nonce) 첨부
4. TDG.createOrder() 호출

### 4.3 API 클라이언트 구조

`@grvt/sdk`를 직접 의존성으로 사용하되, CLI에 필요한 래핑 레이어를 추가:

```typescript
// api-client.ts
import { GrvtClient, EGrvtEnvironment } from '@grvt/sdk';

class CliApiClient {
  private client: GrvtClient;

  constructor(config: CliConfig) {
    this.client = new GrvtClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      env: config.env as EGrvtEnvironment,
    });
  }

  // Market Data (MDG) — 인증 불필요
  async getTicker(instrument: string) { ... }
  async getOrderbook(instrument: string, depth?: number) { ... }
  async getInstruments(kind?: string) { ... }
  async getFundingRate(instrument: string) { ... }

  // Trading (TDG) — 인증 필요
  async createOrder(params: OrderParams) { ... }
  async cancelOrder(orderId: string) { ... }
  async getPositions(subAccountId: string) { ... }
  async getAccountSummary() { ... }
}
```

**Market Data API 호출 경로:**
- `https://market-data.{domain}/full/v1/...` (인증 불필요)

**Trading API 호출 경로:**
- `https://trades.{domain}/full/v1/...` (Cookie 인증 필요)

### 4.4 Builder Fee 내장

모든 주문 생성 시 `metadata.broker`에 Builder 태그를 자동 삽입:

```typescript
// order.ts — create 서브커맨드
const order: IOrder = {
  sub_account_id: config.subAccountId,
  is_market: type === 'market',
  legs: [{
    instrument,
    size,
    limit_price: price,
    is_buying_asset: side === 'buy',
  }],
  metadata: {
    broker: 'BUILDER_TAG',  // GRVT Builder Code
  },
  // ... signature
};
```

### 4.5 출력 포맷

```typescript
// formatter.ts
function output(data: any, format: 'json' | 'table') {
  if (format === 'json') {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    // 테이블 포맷 (console.table 또는 cli-table3)
    printTable(data);
  }
}
```

### 4.6 행동 유도형 에러

```typescript
// error.ts
class ActionableError extends Error {
  constructor(
    message: string,
    public suggestedCommand?: string,
  ) {
    super(message);
  }
}

function handleError(err: any) {
  process.stderr.write(`ERROR: ${err.message}\n`);
  if (err.suggestedCommand) {
    process.stderr.write(`다음 명령어를 실행하세요:\n  ${err.suggestedCommand}\n`);
  }
  process.exit(1);
}

// 예시: 인증 미완료
throw new ActionableError(
  '인증이 필요합니다.',
  'grvt-cli auth login'
);
```

### 4.7 설정 저장소

```
~/.grvt-cli/
├── config.json       # { env, apiKey, apiSecret, subAccountId, builderId }
└── session.json      # { cookie, accountId, expiresAt }
```

---

## 5. 의존성

```json
{
  "dependencies": {
    "@grvt/sdk": "^0.0.4",
    "@grvt/client": "^1.6.5",
    "commander": "^13.0.0",
    "ethers": "^6.13.5",
    "@metamask/eth-sig-util": "^8.2.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsup": "^8.0.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## 6. 환경 설정

| 환경 | 도메인 | Chain ID | 용도 |
|------|--------|----------|------|
| DEV | dev.gravitymarkets.io | 327 | 개발 |
| STAGING | staging.gravitymarkets.io | 327 | 스테이징 |
| TESTNET | testnet.grvt.io | 326 | 테스트넷 (기본값) |
| PRODUCTION | grvt.io | 325 | 메인넷 |

API 엔드포인트 패턴:
- Edge: `https://edge.{domain}`
- Trading: `https://trades.{domain}`
- Market Data: `https://market-data.{domain}`

---

## 7. 구현 순서 (Phase 1 MVP)

### Step 1: 프로젝트 셋업
- [x] package.json 설정 (dependencies, bin 필드)
- [x] tsconfig.json 설정
- [x] tsup.config.ts 설정
- [x] src/index.ts — Commander 기본 구조

### Step 2: 설정 관리
- [x] config/store.ts — ~/.grvt-cli/config.json 읽기/쓰기
- [x] config/constants.ts — 환경별 도메인, Chain ID
- [x] commands/config.ts — `config set`, `config get`, `config list`

### Step 3: 인증
- [x] client/api-client.ts — GrvtClient 래핑, 세션 관리
- [x] commands/auth.ts — `auth login`, `auth status`

### Step 4: 시장 데이터 (인증 불필요)
- [x] commands/market.ts — `market instruments`, `market ticker`, `market orderbook`
- [x] output/formatter.ts — JSON/Table 출력

### Step 5: 주문 관리 (핵심)
- [x] signing/order-signer.ts — EIP-712 주문 서명
- [x] commands/order.ts — `order create`, `order cancel`, `order cancel-all`, `order get`, `order list`, `order history`
- [x] output/error.ts — 행동 유도형 에러

### Step 6: 포지션 및 계정
- [x] commands/position.ts — `position list`
- [x] commands/account.ts — `account summary`, `account sub-account`
- [x] commands/funding.ts — `funding rate`, `funding history`

### Step 7: 빌드 및 배포
- [x] tsup 번들링 설정
- [x] npm bin 필드 설정 (npx grvt-cli)
- [ ] 테스트넷 기반 E2E 테스트

### Step 8: 보안 강화 (v0.1.2)
- [x] CSPRNG nonce 생성 — SDK의 `Math.random()` 대신 `crypto.randomInt()` 사용
- [x] `toScaledInt` 정밀도 보호 — `MAX_SAFE_INTEGER` 초과 시 에러 throw
- [x] `limit_price` 소수점 절삭 방지 — `parseInt` 제거
- [x] `config init` 시크릿 입력 마스킹 — raw mode + `*` 표시
- [x] MCP 입력 검증 — instrument, size, price, order_id에 regex 적용
- [x] TOCTOU race condition 제거 — `existsSync` → try-catch 패턴
- [x] 만료 세션 파일 자동 삭제
- [x] 에러 응답 필터링 — code/message/error 필드만 노출

---

## 8. 설계 원칙

1. **`@grvt/sdk` 최대 활용** — API 호출, 인증, 서명 로직을 재구현하지 않고 SDK 래핑
2. **에이전트 친화적** — `--output json`, `--yes`, 행동 유도형 에러, 비대화형 모드
3. **점진적 구현** — MVP는 핵심 트레이딩 루프(시세→주문→포지션)만 구현, 이후 확장
4. **보안 우선** — apiSecret은 로컬 설정 파일에만 저장, 환경변수 지원, 출금 기능 제외
5. **Builder Fee 자동화** — 모든 주문에 Builder ID 자동 포함

---

## 9. Rate Limits

Trading API (10초당, 펀딩 계정 기준, 거래쌍별 추적):

| 작업 | 제한 |
|------|------|
| Create Order | 260 req/10s |
| Cancel Order | 2,600 req/10s |
| Cancel All | 2,600 req/10s |
| Transfer/Withdraw | 1 req/10s |
| Get Order | 50-650 req/10s (tier별) |
| 기타 읽기 | 25-225 req/10s (tier별) |

Market Data API (분당):

| 작업 | 제한 |
|------|------|
| GetInstrument/Ticker | 1,500 req/min |
| 기타 | 500 req/min |

---

## 10. 참고 사항

### @grvt/sdk 현재 상태
- `@grvt/client`의 TDG/MDG 클래스에 Trading/Market Data API 메서드가 모두 구현되어 있음 → 그대로 사용
- 주문 서명만 `signOrder()` 헬퍼가 없음 → SDK의 `Signer.sign()` + `signing/types.ts`의 `Order` 타입으로 `signTransfer()` 패턴 따라 구현
- 타임스탬프는 **나노초(nanosecond)** 단위 문자열

### REST API 엔드포인트 경로
- Trading: `POST https://trades.{domain}/full/v1/{action}`
  - 예: `full/v1/create_order`, `full/v1/cancel_order`, `full/v1/open_orders`
- Market Data: `POST https://market-data.{domain}/full/v1/{action}`
  - 예: `full/v1/all_instruments`, `full/v1/book`, `full/v1/funding`
- Full(사람 친화적) / Lite(축약형) 두 가지 변형 존재 — CLI는 Full 사용

### WebSocket 스트림
- Trading WS: `wss://trades.{domain}/ws/full`
  - `v1.order`, `v1.fill`, `v1.position` (인증 필요)
- Market Data WS: `wss://market-data.{domain}/ws/full`
  - `v1.ticker.s` / `v1.ticker.d`, `v1.book.s` / `v1.book.d`
  - `.s` = 매번 전체 스냅샷, `.d` = 초기 스냅샷 후 델타만 전송

### API 구조 (TDG — Trading Data Gateway)
- Transfer: preDepositCheck, depositHistory, transfer, transferHistory, withdrawal, withdrawalHistory
- Account: positions, subAccountSummary, fillHistory, fundingPaymentHistory, fundingAccountSummary
- Order: createOrder, createBulkOrders, cancelOrder, cancelAllOrders, order(get), openOrders, orderHistory, replaceOrders
- Leverage: getAllInitialLeverage, setInitialLeverage

### API 구조 (MDG — Market Data Gateway)
- Instruments: instrument, instruments, allInstruments
- Pricing: miniTicker, ticker, orderBook, trade, tradesHistory
- Analytics: settlement, funding, candlestick
