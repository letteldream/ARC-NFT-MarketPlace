import * as ccxt from 'ccxt';
import { FastifyReply, FastifyRequest } from "fastify";
import { DepoUserController } from "../../controller/DepoUserController";
import { IAPIKey } from "../../interfaces/IAPIKey";

const loadBinanceOrders = async (userData, symbol) => {
  const exchange = new ccxt.binance();

  const allMarkets = await exchange.fetchMarkets();

  if(!allMarkets.find(market => market.id === symbol)) return

  exchange.apiKey = userData.apiKey;
  exchange.secret = userData.apiSecret;
  await exchange.checkRequiredCredentials() // throw AuthenticationError

  const responseBinance = {
    openOrders: await exchange.fetchOpenOrders(symbol),
    closedOrders: await exchange.fetchClosedOrders(symbol),
  }
  
  responseBinance.openOrders.forEach((order: any) => order.exchange = 'Binance' );
  responseBinance.closedOrders.forEach((order: any) => order.exchange = 'Binance' );

  return responseBinance;
};

const loadHuobiOrders = async (userData, symbol) => {
  const exchange = new ccxt.huobi({
    'fetchOpenOrdersMethod': 'fetch_open_orders_v2'
  });

  const allMarkets = await exchange.fetchMarkets();
  if(!allMarkets.find(market => market.id === symbol)) return

  exchange.apiKey = userData.apiKey;
  exchange.secret = userData.apiSecret;
  await exchange.checkRequiredCredentials() // throw AuthenticationError

  const responseHuobi = {
    openOrders: await exchange.fetchOpenOrders(symbol),
    closedOrders: await exchange.fetchClosedOrders(symbol),
  }

  responseHuobi.openOrders.forEach((order: any) => order.exchange = 'Huobi' );
  responseHuobi.closedOrders.forEach((order: any) => order.exchange = 'Huobi' );


  return responseHuobi;
};

const loadFTXOrders = async (userData, symbol) => {
  const exchange = new ccxt.ftx();

  const allMarkets = await exchange.fetchMarkets();
  if(!allMarkets.find(market => market.id === symbol)) return


  exchange.apiKey = userData.apiKey;
  exchange.secret = userData.apiSecret;

  // config for subaccounts 
  // exchange.headers = {
  //   'FTX-SUBACCOUNT': 'depo_test',
  // }

  if(userData.extraFields.length > 0){
    const userSubAccount = userData.extraFields.find(field => field.fieldName === 'Subaccount');
    exchange.headers = {
      'FTX-SUBACCOUNT': userSubAccount.value,
    }
  }

  await exchange.checkRequiredCredentials() // throw AuthenticationError
  const orderList = await exchange.fetchOrders();

  const responseFTX = {
    openOrders: orderList.filter(order => order.status !== 'closed' && order.symbol === symbol),
    closedOrders: orderList.filter(order => order.status === 'closed' && order.symbol === symbol),
  }

  responseFTX.openOrders.forEach((order: any) => order.exchange = 'FTX' );
  responseFTX.closedOrders.forEach((order: any) => order.exchange = 'FTX' );

  return responseFTX;
};

export const loadUserOrders = async (req: FastifyRequest, res: FastifyReply) => {
  const { walletId, symbol } = req.params as any;
  const formatedSymbol = symbol.replace('-','/');
  const userController = new DepoUserController();
  const userExchanges :any = await userController.getUserApiKeys(walletId);
  const response = {
    openOrders: [],
    closedOrders: []
  }

  if(userExchanges.find(exchange => exchange.id.toLowerCase() === 'binance' )){
    const binanceResponse = await loadBinanceOrders(userExchanges.find(exchange => exchange.id.toLowerCase() === 'binance'), formatedSymbol)

    if(binanceResponse){
      response.openOrders.push(...binanceResponse.openOrders);
      response.closedOrders.push(...binanceResponse.closedOrders);
    }
  }

  if(userExchanges.find(exchange => exchange.id.toLowerCase() === 'huobi' )){
    const responseHuobi = await loadHuobiOrders(userExchanges.find(exchange => exchange.id.toLowerCase() === 'huobi'), formatedSymbol)

    if(responseHuobi){
      response.openOrders.push(...responseHuobi.openOrders);
      response.closedOrders.push(...responseHuobi.closedOrders);
    }
  }

  if(userExchanges.find(exchange => exchange.id.toLowerCase() === 'ftx' )){
    const responseFTX = await loadFTXOrders(userExchanges.find(exchange => exchange.id.toLowerCase() === 'ftx'), formatedSymbol)

    if(responseFTX){
      response.openOrders.push(...responseFTX.openOrders);
      response.closedOrders.push(...responseFTX.closedOrders);
    }
  }


  // const ordenedResponse = {
  //   openOrders: response.openOrders.sort((a :any, b :any) =>  a.datetime - b.datetime),
  //   closedOrders: response.closedOrders.sort((a :any, b :any) =>  a.datetime - b.datetime)
  // }
  

  return res.send({ response });
}