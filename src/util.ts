import {filter, interval, mergeMap, Observable, take, timeout} from 'rxjs';
import * as cybrid from '@cybrid/cybrid-api-bank-typescript';
import * as crypto from 'crypto';

const jwt = require('jsonwebtoken');

const poll = (obs: Observable<any>, evalFunc: any, maxTime: number) => {
  return interval(1000).pipe(
    mergeMap(_ => obs),
    filter(val => evalFunc(val)),
    take(1),
    timeout({each: maxTime})
  );
};

const create_jwt = (
  signingKey: string,
  verificationKey: cybrid.VerificationKeyBankModel,
  customer: cybrid.CustomerBankModel,
  bankGuid: string
) => {
  const algorithm = 'RS512';
  const kid = verificationKey.guid;
  const customerGuid = customer.guid;
  const issuedAt = new Date();
  const expiredAt = new Date(
    new Date().setFullYear(issuedAt.getFullYear() + 1)
  );
  const uuid = crypto.randomUUID();

  const header = {
    alg: algorithm,
    kid: kid,
  };
  const options = {
    header: header,
  };
  const claims = {
    iss: `http://api.cybrid.app/banks/${bankGuid}`,
    aud: 'http://api.cybrid.app',
    sub: `http://api.cybrid.app/customers/${customerGuid}`,
    iat: issuedAt.getTime(),
    exp: expiredAt.getTime(),
    jti: uuid,
  };

  return jwt.sign(claims, signingKey, options);
};

export {create_jwt, poll};
