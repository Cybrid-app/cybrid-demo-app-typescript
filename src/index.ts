// 1. Create a customer
// 2. Create an attested identity verification for the customer
// 3. Create a USD fiat account for the customer
// 4. Create a BTC-USD trading account for the customer
// 5. Generate a book transfer quote in USD
// 6. Execute the book transfer quote using a transfer
// 7. Get the balance of the customer's USD fiat account
// 8. Generate a buy quote in BTC-USD
// 9. Execute the buy quote using a trade
// 10. Get the balance of the customer's BTC-USD trading account

import {combineLatestWith, from, map, of, share, switchMap, tap} from 'rxjs';
import * as cybrid from '@cybrid/cybrid-api-bank-typescript';

import {poll} from './util';
import {getToken} from './auth';
import {Config} from './config';

global.XMLHttpRequest = require('xhr2');

class InvalidBalanceError extends Error {
  constructor(actualBalance: number, expectedBalance: number) {
    const message = `The account reported an invalid balance. Expected balance: ${expectedBalance}. Actual balance: ${actualBalance}.`;
    super(message);
  }
}

interface IdentificationNumbers {
  type: cybrid.PostIdentificationNumberBankModelTypeEnum;
  issuing_country_code: string;
  identification_number: string;
}

interface PersonName {
  first: string;
  middle?: string,
  last: string
}

interface PersonAddress {
  street: string;
  street2?: string,
  city: string
  subdivision?: string
  postal_code?: string
  country_code: string
}

interface Person {
  name: PersonName;
  address: PersonAddress
  date_of_birth: string,
  phone_number: string
  email_address: string
  identification_numbers: Array<IdentificationNumbers>
}

function main() {
  const getTokenObs = from(getToken()).pipe(share());
  const configurationObs = getTokenObs.pipe(
    map(
      token =>
        new cybrid.Configuration({
          accessToken: `Bearer ${token}`,
          basePath: `${Config.URL_SCHEME}://bank.${Config.BASE_URL}`
        })
    )
  );

  const createIdentityVerification = (customer: cybrid.CustomerBankModel, person: Person) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating identity...');
      }),
      map(configuration => new cybrid.IdentityVerificationsBankApi(configuration)),
      switchMap(api => {
        return api.createIdentityVerification({
          postIdentityVerificationBankModel: {
            type: cybrid.PostIdentityVerificationBankModelTypeEnum.Kyc,
            method: cybrid.PostIdentityVerificationBankModelMethodEnum.Attested,
            customer_guid: customer.guid!,
            name: person.name,
            address: person.address,
            date_of_birth: person.date_of_birth,
            identification_numbers: person.identification_numbers.map(x => x),
          },
        });
      }),
      tap(identityVerification => {
        console.log('Created identity verification.');
        console.log(`    Identity verification guid: ${identityVerification.guid}`);
      })
    );
  };

  const getIdentityVerification = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting identity...');
      }),
      map(configuration => new cybrid.IdentityVerificationsBankApi(configuration)),
      switchMap(api => {
        return api.getIdentityVerification({
          identityVerificationGuid: guid,
        });
      }),
      tap(identityVerification => {
        console.log('Got identity verification.');
        console.log(`    Identity verification guid: ${identityVerification.guid}`);
      })
    );
  };

  const pollIdentityVerification = (guid: string) => {
    const evalFunc = (identityVerification: cybrid.IdentityVerificationBankModel) => {
      const state = identityVerification.state!;
      const expectedState = cybrid.IdentityVerificationBankModelStateEnum.Completed;
      return state === expectedState;
    };
    return poll(getIdentityVerification(guid), evalFunc, Config.TIMEOUT);
  };

  const createCustomer = (person: Person) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating customer...');
      }),
      map(configuration => new cybrid.CustomersBankApi(configuration)),
      switchMap(api => {
        return api.createCustomer({
          postCustomerBankModel: {
            type: cybrid.PostCustomerBankModelTypeEnum.Individual,
            name: person.name,
            address: person.address,
            date_of_birth: person.date_of_birth,
            email_address: person.email_address,
            phone_number: person.phone_number,
            identification_numbers: person.identification_numbers.map(x => x)
          },
        });
      }),
      tap(customer => {
        console.log('Created customer.');
        console.log(`    Customer guid: ${customer.guid}`);
      })
    );
  };

  const getCustomer = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting customer...');
      }),
      map(configuration => new cybrid.CustomersBankApi(configuration)),
      switchMap(api => {
        return api.getCustomer({
          customerGuid: guid,
        });
      }),
      tap(customer => {
        console.log('Got customer.');
        console.log(`    Customer guid: ${customer.guid}`);
      })
    );
  };

  const pollCustomer = (guid: string) => {
    const evalFunc = (customer: cybrid.CustomerBankModel) => {
      const state = customer.state!;
      const expectedState = cybrid.CustomerBankModelStateEnum.Unverified;
      return state === expectedState;
    };
    return poll(getCustomer(guid), evalFunc, Config.TIMEOUT);
  };

  const createAccount = (customer: cybrid.CustomerBankModel, account_type: cybrid.PostAccountBankModelTypeEnum, asset: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log(`Creating ${account_type} account for asset ${asset}...`);
      }),
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => {
        return api.createAccount({
          postAccountBankModel: {
            type: account_type,
            customer_guid: customer.guid!,
            asset: asset,
            name: 'Account',
          },
        });
      }),
      tap(account => {
        console.log(`Created ${account_type} account.`);
        console.log(`    Account guid: ${account.guid}`);
      })
    );
  };

  const getAccount = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting account...');
      }),
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => {
        return api.getAccount({
          accountGuid: guid,
        });
      }),
      tap(account => {
        console.log('Got account.');
        console.log(`    Account guid: ${account.guid}`);
      })
    );
  };

  const pollAccount = (guid: string) => {
    const evalFunc = (account: cybrid.AccountBankModel) => {
      const state = account.state!;
      const expectedState = cybrid.AccountBankModelStateEnum.Created;
      return state === expectedState;
    };
    return poll(getAccount(guid), evalFunc, Config.TIMEOUT);
  };

  const createQuote = (
    customer: cybrid.CustomerBankModel,
    product_type: cybrid.PostQuoteBankModelProductTypeEnum,
    side: cybrid.PostQuoteBankModelSideEnum,
    receiveAmount: number,
    symbol: string | null,
    asset: string | null
  ) => {
    return configurationObs.pipe(
      tap(() => {
        console.log(`Creating ${side} ${product_type} quote for ${symbol || asset} of ${receiveAmount}...`);
      }),
      map(configuration => new cybrid.QuotesBankApi(configuration)),
      switchMap(api => {
        var quoteParameters = {
          product_type: product_type,
          customer_guid: customer.guid!,
          side: side,
          receive_amount: receiveAmount
        } as cybrid.PostQuoteBankModel;

        if (symbol) {
          quoteParameters["symbol"] = symbol;
        }
        if (asset) {
          quoteParameters["asset"] = asset;
        }

        return api.createQuote({
          postQuoteBankModel: quoteParameters,
        });
      }),
      tap(quote => {
        console.log('Created quote.');
        console.log(`    Quote guid: ${quote.guid}`);
      })
    );
  };

  const createTrade = (quote: cybrid.QuoteBankModel) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating trade...');
      }),
      map(configuration => new cybrid.TradesBankApi(configuration)),
      switchMap(api => {
        return api.createTrade({
          postTradeBankModel: {
            quote_guid: quote.guid!,
          },
        });
      }),
      tap(trade => {
        console.log('Created trade.');
        console.log(`    Trade guid: ${trade.guid}`);
      })
    );
  };

  const getTrade = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting trade...');
      }),
      map(configuration => new cybrid.TradesBankApi(configuration)),
      switchMap(api => {
        return api.getTrade({
          tradeGuid: guid,
        });
      }),
      tap(trade => {
        console.log('Got trade.');
        console.log(`    Trade guid: ${trade.guid}`);
        console.log(`    Trade state: ${trade.state}`);
      })
    );
  };

  const pollTrade = (guid: string) => {
    const evalFunc = (trade: cybrid.TradeBankModel) => {
      const state = trade.state!;
      const expectedState = cybrid.TradeBankModelStateEnum.Settling;
      return state === expectedState;
    };
    return poll(getTrade(guid), evalFunc, Config.TIMEOUT);
  };

  const createTransfer = (quote: cybrid.QuoteBankModel, transfer_type: cybrid.PostTransferBankModelTransferTypeEnum) => {
    return configurationObs.pipe(
        tap(() => {
          console.log(`Creating ${transfer_type} trade...`);
        }),
        map(configuration => new cybrid.TransfersBankApi(configuration)),
        switchMap(api => {
          return api.createTransfer({
            postTransferBankModel: {
              quote_guid: quote.guid!,
              transfer_type: transfer_type
            },
          });
        }),
        tap(transfer => {
          console.log('Created transfer.');
          console.log(`    Transfer guid: ${transfer.guid}`);
        })
    );
  };

  const getTransfer = (guid: string) => {
    return configurationObs.pipe(
        tap(() => {
          console.log('Getting transfer...');
        }),
        map(configuration => new cybrid.TransfersBankApi(configuration)),
        switchMap(api => {
          return api.getTransfer({
            transferGuid: guid,
          });
        }),
        tap(transfer => {
          console.log('Got transfer.');
          console.log(`    Transfer guid: ${transfer.guid}`);
          console.log(`    Transfer state: ${transfer.state}`);
        })
    );
  };

  const executeTrade = (customer: cybrid.CustomerBankModel) => {
    of([customer]).pipe(
        switchMap(([customer]) =>
            createQuote(
                customer,
                cybrid.PostQuoteBankModelProductTypeEnum.Trading,
                cybrid.PostQuoteBankModelSideEnum.Buy,
                fiatQuantity,
                "BTC-USD",
                null
            )
        ),
        switchMap(quote => createTrade(quote)),
        switchMap(trade => pollTrade(trade.guid!)),
        switchMap(_trade => getAccount(cryptoAccount.guid!)),
        tap(account => {
          const balance = account.platform_balance!;
          const expectedBalance = cryptoQuantity;
          if (balance !== expectedBalance) {
            throw new InvalidBalanceError(balance, expectedBalance);
          }
        })
    ).subscribe({
      next: account => {
        const fiatBalance = account.platform_balance!;
        console.log(`Fiat USD account for ${customer.guid} has the expected balance: ${fiatBalance}.`);
        console.log('Test has completed successfully!');
      },
      error: err => {
        console.error(`An error has occurred during the test: ${err}`);
        console.error('Test has failed due to an error.');
        throw err;
      }
    })
  };

  const pollTransfer = (guid: string) => {
    const evalFunc = (transfer: cybrid.TransferBankModel) => {
      const state = transfer.state!;
      const expectedState = cybrid.TransferBankModelStateEnum.Completed;
      return state === expectedState;
    };
    return poll(getTransfer(guid), evalFunc, Config.TIMEOUT);
  };

  let customer : cybrid.CustomerBankModel;
  let cryptoAccount : cybrid.AccountBankModel;

  const fiatQuantity = 100_000;
  const cryptoQuantity = 100_000;
  const person: Person = {
    name: {
      first: 'Jane',
      last: 'Doe'
    },
    address: {
      street: '15310 Taylor Walk Suite 995',
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
      }
    ],
  }

  // Create Customer pipeline
  const createCustomerObs = createCustomer(person).pipe(
    switchMap(customer => pollCustomer(customer.guid!)),
    share()
  );

  // Create Identity pipeline, requires Create Customer
  const createIdentityObs = createCustomerObs.pipe(
    switchMap(createdCustomer => {
      customer = createdCustomer;
      return createIdentityVerification(createdCustomer, person);
    }),
    switchMap(identityVerification => pollIdentityVerification(identityVerification.guid!)),
    share(),
  );

  // Create fiat account pipeline, requires Create Customer
  const createFiatAccountObs = createCustomerObs.pipe(
      switchMap(customer => createAccount(customer, cybrid.PostAccountBankModelTypeEnum.Fiat, "USD")),
      switchMap(account => pollAccount(account.guid!)),
      share()
  );

  // Create crypto account pipeline, requires Create Customer
  const createCryptoAccountObs = createCustomerObs.pipe(
      switchMap(customer => createAccount(customer, cybrid.PostAccountBankModelTypeEnum.Trading, "BTC")),
      switchMap(account => {
        cryptoAccount = account;
        return pollAccount(account.guid!);
      }),
      share()
  );

  // Combined Create Identity and Create account pipelines, requires Create Customer
  const createObs = createCustomerObs.pipe(
    combineLatestWith(createIdentityObs, createFiatAccountObs, createCryptoAccountObs)
  );

  // Create Transfer pipeline, requires Create Customer, Create Fiat Account and Create Identity
  const executeTransferObs = createObs.pipe(
      switchMap(([customer]) =>
          createQuote(
              customer,
              cybrid.PostQuoteBankModelProductTypeEnum.BookTransfer,
              cybrid.PostQuoteBankModelSideEnum.Deposit,
              fiatQuantity,
              null,
              "USD"
          )
      ),
      switchMap(quote => createTransfer(quote, cybrid.PostTransferBankModelTransferTypeEnum.Book)),
      switchMap(transfer => pollTransfer(transfer.guid!))
  );

  // Get Account pipeline
  const getFiatAccountObs = createFiatAccountObs.pipe(
      combineLatestWith(executeTransferObs),
      switchMap(([account]) => getAccount(account.guid!))
  );

  // Verify fiat account balance
  getFiatAccountObs
    .pipe(
        tap(account => {
          const balance = account.platform_balance!;
          const expectedBalance = fiatQuantity;
          if (balance !== expectedBalance) {
            throw new InvalidBalanceError(balance, expectedBalance);
          }
        })
    );

  getFiatAccountObs.subscribe({
    next: account => {
      const fiatBalance = account.platform_balance!;
      console.log(`Fiat USD account for ${customer.guid} has the expected balance: ${fiatBalance}.`);
      console.log('Test has completed successfully!');

      executeTrade(customer);
    },
    error: err => {
      console.error(`An error has occurred during the test: ${err}`);
      console.error('Test has failed due to an error.');
      throw err;
    },
  });
}

main();
