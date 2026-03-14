import { GrvtClient } from '@grvt/sdk';
import type { AxiosRequestConfig } from 'axios';
import {
  IApiCreateOrderRequest,
  IApiCreateOrderResponse,
  IApiCancelOrderRequest,
  IApiCancelOrderResponse,
  IApiCancelAllOrdersRequest,
  IApiCancelAllOrdersResponse,
  IApiGetOrderRequest,
  IApiGetOrderResponse,
  IApiOpenOrdersRequest,
  IApiOpenOrdersResponse,
  IApiOrderHistoryRequest,
  IApiOrderHistoryResponse,
  IApiPositionsRequest,
  IApiPositionsResponse,
  IApiSubAccountSummaryRequest,
  IApiSubAccountSummaryResponse,
  IApiFundingAccountSummaryResponse,
  IApiFundingPaymentHistoryRequest,
  IApiFundingPaymentHistoryResponse,
  IApiFundingRateRequest,
  IApiFundingRateResponse,
  IApiTickerRequest,
  IApiTickerResponse,
  IApiOrderbookLevelsRequest,
  IApiOrderbookLevelsResponse,
  IApiGetAllInstrumentsRequest,
  IApiGetAllInstrumentsResponse,
  IApiGetFilteredInstrumentsRequest,
  IApiGetFilteredInstrumentsResponse,
  IApiGetInstrumentRequest,
  IApiGetInstrumentResponse,
  IApiCandlestickRequest,
  IApiCandlestickResponse,
  IApiTradeHistoryRequest,
  IApiTradeHistoryResponse,
  IApiFillHistoryRequest,
  IApiFillHistoryResponse,
  IApiMiniTickerRequest,
  IApiMiniTickerResponse,
} from '@grvt/client/interfaces';
import { CliConfig, SessionData } from '../config/store';
import { ActionableError } from '../output/error';

export class CliApiClient extends GrvtClient {
  private cliConfig: CliConfig;

  constructor(config: CliConfig) {
    super({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      env: config.env,
    });
    this.cliConfig = config;
  }

  // --- Session persistence (for CLI disk storage) ---

  async login(): Promise<SessionData> {
    if (!this.cliConfig.apiKey) {
      throw new ActionableError(
        'API key is not configured.',
        'grvt-cli config set --api-key <your-api-key>'
      );
    }

    const cookie = await this.refreshCookie();
    if (!cookie) {
      throw new ActionableError(
        'Login failed: no session cookie received.',
        'grvt-cli config set --api-key <your-api-key>'
      );
    }

    return {
      cookie: cookie.gravity,
      accountId: cookie.XGrvtAccountId,
      expiresAt: cookie.expires,
    };
  }

  setSession(session: SessionData): void {
    this.cookie = {
      gravity: session.cookie,
      expires: session.expiresAt,
      XGrvtAccountId: session.accountId,
    };
  }

  // --- Auth config for TDG ---

  private async authConfig(): Promise<AxiosRequestConfig> {
    await this.refreshCookie();
    if (!this.cookie) {
      throw new ActionableError(
        'Not authenticated. Session expired or not logged in.',
        'grvt-cli auth login'
      );
    }

    // Use plain object headers — AxiosHeaders class instances from the bundled
    // axios are not recognized by @grvt/client's external axios copy.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cookie': `gravity=${this.cookie.gravity}`,
    };
    if (this.cookie.XGrvtAccountId) {
      headers['X-Grvt-Account-Id'] = this.cookie.XGrvtAccountId;
    }
    return { headers };
  }

  // --- Market Data (no auth required, delegates to mdgClient) ---

  async getAllInstruments(
    request: IApiGetAllInstrumentsRequest
  ): Promise<IApiGetAllInstrumentsResponse> {
    return this.mdgClient.allInstruments(request);
  }

  async getInstruments(
    request: IApiGetFilteredInstrumentsRequest
  ): Promise<IApiGetFilteredInstrumentsResponse> {
    return this.mdgClient.instruments(request);
  }

  async getTicker(
    request: IApiTickerRequest
  ): Promise<IApiTickerResponse> {
    return this.mdgClient.ticker(request);
  }

  async getMiniTicker(
    request: IApiMiniTickerRequest
  ): Promise<IApiMiniTickerResponse> {
    return this.mdgClient.miniTicker(request);
  }

  async getOrderbook(
    request: IApiOrderbookLevelsRequest
  ): Promise<IApiOrderbookLevelsResponse> {
    return this.mdgClient.orderBook(request);
  }

  async getFundingRate(
    request: IApiFundingRateRequest
  ): Promise<IApiFundingRateResponse> {
    return this.mdgClient.funding(request);
  }

  async getCandlestick(
    request: IApiCandlestickRequest
  ): Promise<IApiCandlestickResponse> {
    return this.mdgClient.candlestick(request);
  }

  async getTradeHistory(
    request: IApiTradeHistoryRequest
  ): Promise<IApiTradeHistoryResponse> {
    return this.mdgClient.tradesHistory(request);
  }

  async getInstrument(
    request: IApiGetInstrumentRequest
  ): Promise<IApiGetInstrumentResponse> {
    return this.mdgClient.instrument(request);
  }

  // --- Trading (auth required, delegates to tdgClient) ---

  async createOrder(
    request: IApiCreateOrderRequest
  ): Promise<IApiCreateOrderResponse> {
    const config = await this.authConfig();
    return this.tdgClient.createOrder(request, config);
  }

  async cancelOrder(
    request: IApiCancelOrderRequest
  ): Promise<IApiCancelOrderResponse> {
    const config = await this.authConfig();
    return this.tdgClient.cancelOrder(request, config);
  }

  async cancelAllOrders(
    request: IApiCancelAllOrdersRequest
  ): Promise<IApiCancelAllOrdersResponse> {
    const config = await this.authConfig();
    return this.tdgClient.cancelAllOrders(request, config);
  }

  async getOrder(
    request: IApiGetOrderRequest
  ): Promise<IApiGetOrderResponse> {
    const config = await this.authConfig();
    return this.tdgClient.order(request, config);
  }

  async getOpenOrders(
    request: IApiOpenOrdersRequest
  ): Promise<IApiOpenOrdersResponse> {
    const config = await this.authConfig();
    return this.tdgClient.openOrders(request, config);
  }

  async getOrderHistory(
    request: IApiOrderHistoryRequest
  ): Promise<IApiOrderHistoryResponse> {
    const config = await this.authConfig();
    return this.tdgClient.orderHistory(request, config);
  }

  async getPositions(
    request: IApiPositionsRequest
  ): Promise<IApiPositionsResponse> {
    const config = await this.authConfig();
    return this.tdgClient.positions(request, config);
  }

  override async getSubAccountSummary(
    request: IApiSubAccountSummaryRequest
  ): Promise<IApiSubAccountSummaryResponse> {
    const config = await this.authConfig();
    return this.tdgClient.subAccountSummary(request, config);
  }

  override async getFundingAccountSummary(): Promise<IApiFundingAccountSummaryResponse> {
    const config = await this.authConfig();
    return this.tdgClient.fundingAccountSummary(config);
  }

  async getFundingPaymentHistory(
    request: IApiFundingPaymentHistoryRequest
  ): Promise<IApiFundingPaymentHistoryResponse> {
    const config = await this.authConfig();
    return this.tdgClient.fundingPaymentHistory(request, config);
  }

  async getFillHistory(
    request: IApiFillHistoryRequest
  ): Promise<IApiFillHistoryResponse> {
    const config = await this.authConfig();
    return this.tdgClient.fillHistory(request, config);
  }

}
