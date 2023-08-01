/**
 * Cybrid Typescript Demo Application
 *
 * Workflow:
 *
 * 1. Create a customer
 * 2. Create an attested identity verification for the customer
 * 3. Get USD fiat account for the bank
 * 4. Create a USD fiat accuont for the customer
 * 5. Generate a book transfer quote in USD
 * 6. Execute the book transfer quote using a transfer
 * 7. Get the balance of the customer's USD fiat account
 * 8. Create a crypto trading accounts: BTC, ETH, USDC for the customer
 * 9. Create cyrpto wallets for the customer
 * 10. Generate buy quotes
 * 11. Execute buy quotes using a trade
 * 12. Execute a crypto withdrawal
 * 13. Get the balance of the customer's crypto trading account
 */

global.XMLHttpRequest = require('xhr2');

import * as cybrid from '@cybrid/cybrid-api-bank-typescript';
import { poll, generateRandomBase64 } from './util';
import * as Currency from './currency';
import { getToken } from './auth';
import { Config } from './config';
import { error } from 'console';

import {
  combineLatest,
  throwIfEmpty,
  Observable,
  catchError,
  switchMap,
  filter,
  share,
  from,
  tap,
  map,
} from 'rxjs';

// Typescript helper to define a person
interface Person {
  name: cybrid.PostIdentityVerificationNameBankModel;
  address: cybrid.PostIdentityVerificationAddressBankModel;
  date_of_birth: string;
  phone_number: string;
  email_address: string;
  identification_numbers: Array<cybrid.PostIdentificationNumberBankModel>;
}

function main() {

  const getToken$ = from(getToken()).pipe(share());
  const configuration$ = getToken$.pipe(
    map(
      token =>
        new cybrid.Configuration({
          accessToken: `Bearer ${token}`,
          basePath: `${Config.URL_SCHEME}://${Config.BASE_URL}`
        })
    )
  );

  const person: Person = {
    name: {
      first: 'Jane',
      middle: undefined,
      last: 'Doe',
    },
    address: {
      street: '15310 Taylor Walk Suite 995',
      street2: undefined,
      city: 'New York',
      subdivision: 'NY',
      postal_code: '12099',
      country_code: 'US',
    },
    date_of_birth: '2001-01-01',
    email_address: 'jane.doe@example.org',
    phone_number: '+12406525665',
    identification_numbers: [
      {
        type: cybrid.PostIdentificationNumberBankModelTypeEnum.SocialSecurityNumber,
        issuing_country_code: 'US',
        identification_number: '669-55-0349',
      },
      {
        type: cybrid.PostIdentificationNumberBankModelTypeEnum.DriversLicense,
        issuing_country_code: 'US',
        identification_number: 'D152096714850065',
      },
    ],
  };


  function create_customer(person: Person): Observable<cybrid.CustomerBankModel> {
    const postCustomerNameModel: cybrid.PostCustomerNameBankModel = <cybrid.PostCustomerNameBankModel>person.name
    const postCustomerBankModel: cybrid.PostCustomerBankModel = {
      type: cybrid.PostCustomerBankModelTypeEnum.Individual,
      name: postCustomerNameModel,
      address: person.address,
      date_of_birth: person.date_of_birth,
      email_address: person.email_address,
      phone_number: person.phone_number,
      identification_numbers: person.identification_numbers
    }

    return configuration$.pipe(
      map(configuration => new cybrid.CustomersBankApi(configuration)),
      tap(() => console.log('Creating customer...')),
      switchMap(api => {
        return api.createCustomer({ postCustomerBankModel });
      }),
      tap((customer) => console.log(`Created customer ${customer.guid}`)),
      catchError((e) => {
        throw error(`An error ocurred when creating a customer: ${e.response}`)
      })
    )
  }

  function get_customer(guid: string): Observable<cybrid.CustomerBankModel> {
    console.log(`Getting customer: ${guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.CustomersBankApi(configuration)),
      switchMap(api => {
        return api.getCustomer({
          customerGuid: guid
        });
      }),
      tap((customer) => console.log(`Got customer: ${customer.guid}, state: ${customer.state}`)),
      catchError((e) => {
        throw error(`An error ocurred when getting a customer: ${e.response}`);
      })
    )
  }

  function wait_for_customer_unverified(customer: cybrid.CustomerBankModel): Observable<cybrid.CustomerBankModel> {
    return poll(get_customer(customer.guid!), (customer: cybrid.CustomerBankModel) => {
      const state = customer.state!;
      const expectedState = cybrid.CustomerBankModelStateEnum.Unverified;
      return state === expectedState;
    }, Config.TIMEOUT);
  }

  function create_account(customer: cybrid.CustomerBankModel, type: cybrid.PostAccountBankModelTypeEnum, asset: string): Observable<cybrid.AccountBankModel> {
    console.log(`Creating account: ${asset}...`);

    const postAccountBankModel: cybrid.PostAccountBankModel = {
      type: type,
      customer_guid: customer.guid!,
      asset: asset,
      name: `${asset}, account for customer: ${customer.guid}`
    }

    return configuration$.pipe(
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => api.createAccount({ postAccountBankModel })),
      tap((account) => console.log(`Created account: ${account.guid}`)),
      catchError((e) => {
        throw error(`An error ocurred when creating an account: ${e.response}`);
      })
    )
  }

  function list_accounts(owner: cybrid.ListRequestOwnerBankModel, type: cybrid.AccountBankModelTypeEnum): Observable<cybrid.AccountBankModel[]> {
    console.log('Listing accounts...');

    const listAccountsRequest: cybrid.ListAccountsRequest = {
      owner: owner,
      type: type
    }

    return configuration$.pipe(
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => api.listAccounts(listAccountsRequest)),
      map(list => list.objects),
      tap(() => console.log('Listed accounts.')),
      catchError((e) => {
        throw error(`An error ocurred when listing accounts: ${e.response}`);
      })
    )
  }

  function get_account(guid: string): Observable<cybrid.AccountBankModel> {
    console.log(`Getting account: ${guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => api.getAccount({ accountGuid: guid })),
      tap((account) => console.log(`Got account: ${account.guid}, state: ${account.state}`)),
      catchError((e) => {
        throw error(`An error ocurred when getting an account: ${e.response}`);
      })
    )
  }


  function wait_for_account_created(account: cybrid.AccountBankModel): Observable<cybrid.AccountBankModel> {
    return poll(get_account(account.guid!), (account: cybrid.AccountBankModel) => {
      const state = account.state;
      const expectedState = cybrid.AccountBankModelStateEnum.Created;
      return state === expectedState;
    }, Config.TIMEOUT);
  }

  function wait_for_expected_account_balance(account: cybrid.AccountBankModel, expected_balance: number) {
    return poll(get_account(account.guid!), (account: cybrid.AccountBankModel) => {
      const balance = account.platform_balance;
      return balance === expected_balance;
    }, Config.TIMEOUT);
  }

  function create_identity_verification(customer: cybrid.CustomerBankModel, person: Person): Observable<cybrid.IdentityVerificationBankModel> {
    console.log('Creating identity verfification...');

    const postIdentityVerificationNameBankModel: cybrid.PostIdentityVerificationNameBankModel = person.name
    const postIdentityVerificationAddressBankModel: cybrid.PostIdentityVerificationAddressBankModel = person.address
    const postIdentificationNumberBankModel: Array<cybrid.PostIdentificationNumberBankModel> = person.identification_numbers

    const postIdentityVerificationBankModel: cybrid.PostIdentityVerificationBankModel = {
      type: cybrid.PostIdentityVerificationBankModelTypeEnum.Kyc,
      method: cybrid.PostIdentityVerificationBankModelMethodEnum.Attested,
      customer_guid: customer.guid,
      name: postIdentityVerificationNameBankModel,
      address: postIdentityVerificationAddressBankModel,
      date_of_birth: person.date_of_birth,
      identification_numbers: postIdentificationNumberBankModel
    }

    return configuration$.pipe(
      map(configuration => new cybrid.IdentityVerificationsBankApi(configuration)),
      switchMap(api => {
        return api.createIdentityVerification({ postIdentityVerificationBankModel })
      }),
      tap((identity_verification) => console.log(`Created identity verification: ${identity_verification.guid}`)),
      catchError((e) => {
        throw error(`An error ocurred when creating an identity: ${e.response}`)
      })
    )
  }

  function get_identity_verification(guid: string): Observable<cybrid.IdentityVerificationBankModel> {
    console.log(`Getting identity verification: ${guid}`);

    return configuration$.pipe(
      map(configuration => new cybrid.IdentityVerificationsBankApi(configuration)),
      switchMap(api => api.getIdentityVerification({ identityVerificationGuid: guid })),
      tap((identity_verification) => console.log(`Got identity verification: ${identity_verification.guid}`)),
      catchError((e) => {
        throw error(`An error ocurred when getting identity: ${e.response}`)
      })
    )
  }

  function wait_for_identity_verification_completed(identity_verification: cybrid.IdentityVerificationBankModel): Observable<cybrid.IdentityVerificationBankModel> {
    return poll(get_identity_verification(identity_verification.guid!), (identity_verification: cybrid.IdentityVerificationBankModel) => {
      const state = identity_verification.state!;
      const expectedState = cybrid.IdentityVerificationBankModelStateEnum.Completed;
      return state === expectedState;
    }, Config.TIMEOUT);
  }

  function create_quote({
    customer,
    product_type,
    side,
    asset,
    symbol,
    receive_amount,
    deliver_amount,
  }: {
    customer: cybrid.CustomerBankModel;
    product_type: cybrid.PostQuoteBankModelProductTypeEnum;
    side: cybrid.PostQuoteBankModelSideEnum;
    asset?: string;
    symbol?: string;
    receive_amount?: number;
    deliver_amount?: number;
  }): Observable<cybrid.QuoteBankModel> {

    console.log('Creating quote...');

    const postQuoteBankModel: cybrid.PostQuoteBankModel = {
      product_type: product_type,
      customer_guid: customer.guid,
      asset: asset,
      symbol: symbol,
      side: side,
      receive_amount: receive_amount,
      deliver_amount: deliver_amount
    }

    return configuration$.pipe(
      map(configuration => new cybrid.QuotesBankApi(configuration)),
      switchMap(api => api.createQuote({ postQuoteBankModel })),
      tap((quote) => console.log(`Created quote: ${quote.guid}`)),
      catchError((e) => {
        throw new Error(`An error ocurred when creating a quote: ${JSON.stringify(e.response)}`);
      })
    )
  }

  function create_transfer({
    quote,
    transfer_type,
    source_platform_account,
    destination_platform_account,
    external_wallet,
  }: {
    quote: cybrid.QuoteBankModel;
    transfer_type: cybrid.PostTransferBankModelTransferTypeEnum;
    source_platform_account?: cybrid.AccountBankModel;
    destination_platform_account?: cybrid.AccountBankModel;
    external_wallet?: cybrid.ExternalWalletBankModel;
  }): Observable<cybrid.TransferBankModel> {
    console.log(`Creating ${transfer_type} transfer...`);

    const postTransferBankModel: cybrid.PostTransferBankModel = {
      quote_guid: quote.guid!,
      transfer_type: transfer_type,
    };

    if (source_platform_account) {
      postTransferBankModel.source_account_guid = source_platform_account.guid;
    }

    if (destination_platform_account) {
      postTransferBankModel.destination_account_guid = destination_platform_account.guid;
    }

    if (external_wallet) {
      postTransferBankModel.external_wallet_guid = external_wallet.guid;
    }

    return configuration$.pipe(
      map(configuration => new cybrid.TransfersBankApi(configuration)),
      switchMap(api => api.createTransfer({ postTransferBankModel })),
      tap((transfer) => console.log(`Created ${transfer_type} transfer: ${transfer.guid}`)),
      catchError(e => {
        throw error(`An error ocurred when creating a ${transfer_type} transfer: ${e.response}`)
      })
    );
  }

  function get_transfer(guid: string): Observable<cybrid.TransferBankModel> {
    console.log(`Getting transfer: ${guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.TransfersBankApi(configuration)),
      switchMap(api => api.getTransfer({ transferGuid: guid })),
      tap((transfer) => console.log(`Got transfer: ${transfer.guid}, state: ${transfer.state}`)),
      catchError((e) => {
        throw error(`An error ocurred when getting transfer: ${e.response.error}`);
      })
    )
  }

  function wait_for_transfer_created(transfer: cybrid.TransferBankModel): Observable<cybrid.TransferBankModel> {
    return poll(get_transfer(transfer.guid!), (transfer: cybrid.TransferBankModel) => {
      const state = transfer.state!;
      const expectedState = cybrid.TransferBankModelStateEnum.Completed;
      return state === expectedState;
    }, Config.TIMEOUT);
  }

  function create_external_wallet(customer: cybrid.CustomerBankModel, asset: string): Observable<cybrid.ExternalWalletBankModel> {
    console.log(`Creating external wallet for ${asset}...`);

    const postExternalWalletBankModel: cybrid.PostExternalWalletBankModel = {
      name: `External wallet for ${customer.guid}`,
      asset: asset,
      address: generateRandomBase64(16),
      tag: generateRandomBase64(16),
      customer_guid: customer.guid,
    }

    return configuration$.pipe(
      map(configuration => new cybrid.ExternalWalletsBankApi(configuration)),
      switchMap(api => api.createExternalWallet({ postExternalWalletBankModel })),
      tap((wallet) => console.log(`Created external wallet: ${wallet.guid} `)),
      catchError((e) => {
        throw error(`An error ocurred when creating external wallet: ${e.response} `);
      })
    )
  }

  function get_external_wallet(guid: string): Observable<cybrid.ExternalWalletBankModel> {
    console.log(`Getting external wallet: ${guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.ExternalWalletsBankApi(configuration)),
      switchMap(api => api.getExternalWallet({ externalWalletGuid: guid })),
      tap((wallet) => console.log(`Got external wallet: ${wallet.guid}, state: ${wallet.state}`)),
      catchError((e) => {
        throw error(`An error ocurred when getting external wallet: ${e.response}`);
      })
    )
  }

  function wait_for_external_wallet_created(external_wallet: cybrid.ExternalWalletBankModel): Observable<cybrid.ExternalWalletBankModel> {
    return poll(get_external_wallet(external_wallet.guid!), (external_wallet: cybrid.ExternalWalletBankModel) => {
      const state = external_wallet.state;
      const expectedState = cybrid.ExternalWalletBankModelStateEnum.Completed;
      return state === expectedState;
    }, Config.TIMEOUT);
  }

  function create_trade(quote: cybrid.QuoteBankModel): Observable<cybrid.TradeBankModel> {
    console.log(`Creating trade for quote: ${quote.guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.TradesBankApi(configuration)),
      switchMap(api => api.createTrade({ postTradeBankModel: { quote_guid: quote.guid! } })),
      tap((trade) => console.log(`Created trade: ${trade.guid} `)),
      catchError((e) => {
        throw error(`An error ocurred when creating trade: ${e.response.error}`);
      })
    )
  }

  function get_trade(guid: string): Observable<cybrid.TradeBankModel> {
    console.log(`Getting trade: ${guid}...`);

    return configuration$.pipe(
      map(configuration => new cybrid.TradesBankApi(configuration)),
      switchMap(api => api.getTrade({ tradeGuid: guid })),
      tap((trade) => console.log(`Got trade: ${trade.guid}, state: ${trade.state} `)),
      catchError((e) => {
        throw error(`An error ocurred when getting trade: ${e.response}`);
      })
    )
  }

  function wait_for_trade_created(trade: cybrid.TradeBankModel): Observable<cybrid.TradeBankModel> {
    return poll(get_trade(trade.guid!), (trade: cybrid.TradeBankModel) => {
      const state = trade.state!;
      const expectedState = [
        cybrid.TradeBankModelStateEnum.Settling,
        cybrid.TradeBankModelStateEnum.Completed,
        cybrid.TradeBankModelStateEnum.Failed
      ]
      return expectedState.some(s => s === state);
    }, Config.TIMEOUT);
  }

  /**
   * Run workflow tests
   */

  function run_tests() {

    /**
     * Create customer
     */

    const customer$ = create_customer(person).pipe(
      switchMap((customer) => wait_for_customer_unverified(customer)),
      share()
    )

    const identity_verification$ = customer$.pipe(
      switchMap((customer) => create_identity_verification(customer, person)),
      switchMap((identity_verification) => wait_for_identity_verification_completed(identity_verification)),
      share()
    )

    /**
     * Check for bank USD account
     */

    const bank_fiat_usd_account$ = combineLatest([customer$, identity_verification$]).pipe(
      switchMap(() => list_accounts(cybrid.ListRequestOwnerBankModel.Bank, cybrid.AccountBankModelTypeEnum.Fiat)),
      filter((accounts => accounts.some(account => account.asset === 'USD'))),
      throwIfEmpty(() => new Error('Bank has no USD fiat bank account')),
      map((accounts) => accounts[0]),
      share()
    )

    /**
     * Create customer USD account
     */

    const customer_fiat_usd_account$ = combineLatest([customer$, bank_fiat_usd_account$]).pipe(
      switchMap(([customer]) => create_account(customer, cybrid.PostAccountBankModelTypeEnum.Fiat, 'USD')),
      switchMap((account) => wait_for_account_created(account)),
      share()
    )

    /**
     * Add funds to customer USD account
     */

    // Units are in cents, so $1000 * ¢100
    const usd_quantity = 1000 * 100

    // Generate book transfer quote
    const fiat_book_transfer_quote$ = combineLatest([
      customer$,
      bank_fiat_usd_account$,
      customer_fiat_usd_account$
    ]).pipe(
      switchMap(([customer]) => {
        return create_quote(
          {
            customer,
            product_type: cybrid.PostQuoteBankModelProductTypeEnum.BookTransfer,
            side: cybrid.PostQuoteBankModelSideEnum.Deposit,
            asset: Currency.usd.iso_code,
            receive_amount: usd_quantity,
          }
        )
      }),
      share()
    )

    // Execute book transfer
    const fiat_book_transfer$ = combineLatest([
      fiat_book_transfer_quote$,
      bank_fiat_usd_account$,
      customer_fiat_usd_account$,
      identity_verification$,
    ]).pipe(
      switchMap(([quote, bank_fiat_usd_account, customer_fiat_usd_account]) => {
        return create_transfer(
          {
            quote,
            transfer_type: cybrid.PostTransferBankModelTransferTypeEnum.Book,
            source_platform_account: bank_fiat_usd_account,
            destination_platform_account: customer_fiat_usd_account
          }
        )
      }),
      switchMap((transfer) => wait_for_transfer_created(transfer)),
      share()
    )

    /**
     * Check customer USD account balance
     */

    const customer_fiat_usd_balance$ = combineLatest([customer_fiat_usd_account$, fiat_book_transfer$]).pipe(
      switchMap(([customer_fiat_usd_account]) => get_account(customer_fiat_usd_account.guid!)),
      tap((account) => {
        if (account.platform_balance !== usd_quantity) {
          throw error(`Expected account balance to be: ${usd_quantity} but got: ${account.platform_balance}`)
        } else {
          console.log(`Fiat USD account has the expected balance: ${account.platform_balance} `)
        }
      }),
      share()
    )

    // Run the following workflow against list of crypto currencies in the config
    Config.CRYPTO_ASSETS.forEach((asset) => {

      /**
       * Crypto account
       */

      const crypto_account$ = combineLatest([customer$, customer_fiat_usd_balance$]).pipe(
        switchMap(([customer]) => create_account(
          customer,
          cybrid.PostAccountBankModelTypeEnum.Trading,
          asset
        )),
        switchMap((account) => wait_for_account_created(account)),
        share()
      )

      /**
       * Crypto wallet
       */

      const external_wallet$ = combineLatest([customer$, crypto_account$]).pipe(
        switchMap(([customer]) => create_external_wallet(
          customer,
          asset
        )),
        switchMap((wallet) => wait_for_external_wallet_created(wallet)),
        share()
      )

      /**
       * Purchase crypto
       */

      const deliver_amount = 250 * 100

      // Generate trade quote
      const quote$ = combineLatest([customer$, crypto_account$, external_wallet$]).pipe(
        switchMap(([customer]) => {
          return create_quote({
            customer,
            product_type: cybrid.PostQuoteBankModelProductTypeEnum.Trading,
            side: cybrid.PostQuoteBankModelSideEnum.Buy,
            deliver_amount,
            symbol: `${asset}-USD`
          })
        }),
        share()
      )

      // Execute trade
      const trade$ = quote$.pipe(
        switchMap((quote) => create_trade(quote)),
        switchMap((trade) => wait_for_trade_created(trade)),
        share()
      )

      /**
       * Transfer crypto
       */

      const balance$ = combineLatest([crypto_account$, trade$]).pipe(
        switchMap(([account, trade]) => wait_for_expected_account_balance(account, trade.receive_amount!)),
        share(),
      )

      // Generate transfer quote
      const crypto_transfer_quote$ = combineLatest([customer$, balance$]).pipe(
        switchMap(([customer, balance]) => {
          return create_quote(
            {
              customer,
              product_type: cybrid.PostQuoteBankModelProductTypeEnum.CryptoTransfer,
              side: cybrid.PostQuoteBankModelSideEnum.Withdrawal,
              asset: asset,
              deliver_amount: balance.platform_balance
            }
          )
        }),
        share()
      )

      // Execute transfer
      const crypto_withdrawal_transfer$ = combineLatest([crypto_transfer_quote$, external_wallet$]).pipe(
        switchMap(([quote, external_wallet]) => {
          return create_transfer(
            {
              quote,
              transfer_type: cybrid.PostTransferBankModelTransferTypeEnum.Crypto,
              external_wallet
            }
          )
        }),
        switchMap((transfer) => wait_for_transfer_created(transfer)),
        share()
      )

      /**
       * Check crypto balances
       */

      combineLatest([crypto_account$, crypto_withdrawal_transfer$]).pipe(
        switchMap(([account]) => wait_for_expected_account_balance(account, 0)),
        tap((account) => console.log(`Crypto ${account.asset} account has the expected balance: ${account.platform_balance}`))
      ).subscribe()

    })
  }

  run_tests()
}

main();
