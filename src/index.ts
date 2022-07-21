// 1. Create a customer
// 2. Create a BTC-USD trading account
// 3. Create an identity record
// 4. Generate a buy quote for BTC-USD
// 5. Execute the buy quote
// 6. Get a balance of the customer's BTC-USD trading account

import {combineLatestWith, from, map, share, switchMap, tap} from 'rxjs';
import * as cybrid from '@cybrid/cybrid-api-bank-typescript';

import {create_jwt, poll} from './util';
import {getToken} from './auth';
import {Config} from './config';

global.XMLHttpRequest = require('xhr2');

class InvalidBalanceError extends Error {
  constructor(actualBalance: number, expectedBalance: number) {
    const message = `The account reported an invalid balance. Expected balance: ${expectedBalance}. Actual balance: ${actualBalance}.`;
    super(message);
  }
}

function main() {
  const getTokenObs = from(getToken()).pipe(share());
  const configurationObs = getTokenObs.pipe(
    map(
      token =>
        new cybrid.Configuration({
          accessToken: `Bearer ${token}`,
        })
    )
  );

  const getVerificationKey = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting verification key...');
      }),
      map(configuration => new cybrid.VerificationKeysBankApi(configuration)),
      switchMap(api => {
        return api.getVerificationKey({verificationKeyGuid: guid});
      }),
      tap(verificationKey => {
        console.log('Got verification key.');
        console.log(`    Verification key guid: ${verificationKey.guid}`);
      })
    );
  };

  const createIdentityRecord = (
    signingKey: string,
    verificationKey: cybrid.VerificationKeyBankModel,
    customer: cybrid.CustomerBankModel,
    bankGuid: string
  ) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating identity...');
      }),
      map(configuration => new cybrid.IdentityRecordsBankApi(configuration)),
      switchMap(api => {
        const jwt = create_jwt(signingKey, verificationKey, customer, bankGuid);
        const type = cybrid.PostIdentityRecordBankModelTypeEnum.Attestation;
        return api.createIdentityRecord({
          postIdentityRecordBankModel: {
            customer_guid: customer.guid!,
            type: type,
            attestation_details: {
              token: jwt,
            },
          },
        });
      }),
      tap(identityRecord => {
        console.log('Created identity record.');
        console.log(`    Identity record guid: ${identityRecord.guid}`);
      })
    );
  };

  const getIdentityRecord = (guid: string) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Getting identity...');
      }),
      map(configuration => new cybrid.IdentityRecordsBankApi(configuration)),
      switchMap(api => {
        return api.getIdentityRecord({
          identityRecordGuid: guid,
        });
      }),
      tap(identityRecord => {
        console.log('Got identity record.');
        console.log(`    Identity record guid: ${identityRecord.guid}`);
      })
    );
  };

  const pollIdentity = (guid: string) => {
    const evalFunc = (identityRecord: cybrid.IdentityRecordBankModel) => {
      const state = identityRecord.attestation_details!.state!;
      const expectedState =
        cybrid.AttestationDetailsBankModelStateEnum.Verified;
      return state === expectedState;
    };
    return poll(getIdentityRecord(guid), evalFunc, Config.TIMEOUT);
  };

  const createCustomer = () => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating customer...');
      }),
      map(configuration => new cybrid.CustomersBankApi(configuration)),
      switchMap(api => {
        return api.createCustomer({
          postCustomerBankModel: {
            type: cybrid.PostCustomerBankModelTypeEnum.Individual,
          },
        });
      }),
      tap(customer => {
        console.log('Created customer.');
        console.log(`    Customer guid: ${customer.guid}`);
      })
    );
  };

  const createAccount = (customer: cybrid.CustomerBankModel) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating account...');
      }),
      map(configuration => new cybrid.AccountsBankApi(configuration)),
      switchMap(api => {
        return api.createAccount({
          postAccountBankModel: {
            type: cybrid.PostAccountBankModelTypeEnum.Trading,
            customer_guid: customer.guid!,
            asset: 'BTC',
            name: 'Account',
          },
        });
      }),
      tap(account => {
        console.log('Created account.');
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
    side: cybrid.PostQuoteBankModelSideEnum,
    symbol: string,
    receiveAmount: number
  ) => {
    return configurationObs.pipe(
      tap(() => {
        console.log('Creating quote...');
      }),
      map(configuration => new cybrid.QuotesBankApi(configuration)),
      switchMap(api => {
        return api.createQuote({
          postQuoteBankModel: {
            customer_guid: customer.guid!,
            symbol: symbol,
            side: side,
            receive_amount: receiveAmount,
          },
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

  /*
   *         Create Customer
   *                |
   *              / | \
   *             /  |  \
   *       Create   |   Create
   *      Account   |   Identity
   *             \  |  /
   *              \ | /
   *                |
   *          Create Quote
   *                |
   *                |
   *          Create Trade
   *                |
   *                |
   *          Get Account
   */

  const quantity = 100_000_000;

  // Create Customer pipeline
  const createCustomerObs = createCustomer().pipe(share());

  // Create Account pipeline, requires Create Customer
  const createAccountObs = createCustomerObs.pipe(
    switchMap(customer => createAccount(customer)),
    switchMap(account => pollAccount(account.guid!)),
    share()
  );

  // Create Identity pipeline, requires Create Customer
  const createIdentityObs = createCustomerObs.pipe(
    combineLatestWith(getVerificationKey(Config.VERIFICATION_KEY_GUID)),
    switchMap(([customer, verificationKey]) =>
      createIdentityRecord(
        Config.ATTESTATION_SIGNING_KEY,
        verificationKey,
        customer,
        Config.BANK_GUID
      )
    ),
    switchMap(identityRecord => pollIdentity(identityRecord.guid!))
  );

  // Combined Create Identity and Create Account pipeline, requires Create Customer
  const createObs = createCustomerObs.pipe(
    combineLatestWith(createAccountObs, createIdentityObs)
  );

  // Create Trade pipeline, requires Create Customer, Create Account, and Create Identity
  const executeTradeObs = createObs.pipe(
    switchMap(([customer]) =>
      createQuote(
        customer,
        cybrid.PostQuoteBankModelSideEnum.Buy,
        'BTC-USD',
        quantity
      )
    ),
    switchMap(quote => createTrade(quote)),
    switchMap(trade => pollTrade(trade.guid!))
  );

  // Get Account pipeline
  const getAccountObs = createAccountObs.pipe(
    combineLatestWith(executeTradeObs),
    switchMap(([account]) => getAccount(account.guid!))
  );

  // Verify account balance
  getAccountObs
    .pipe(
      tap(account => {
        const balance = account.platform_balance!;
        const expectedBalance = quantity;
        if (balance !== expectedBalance) {
          throw new InvalidBalanceError(balance, expectedBalance);
        }
      })
    )
    .subscribe({
      next: account => {
        const balance = account.platform_balance!;
        console.log(`Account has the expected balance: ${balance}.`);
        console.log('Test has completed successfully!');
      },
      error: err => {
        console.error(`An error has occurred during the test: ${err}`);
        console.error('Test has failed due to an error.');
        throw err;
      },
    });
}

main();
