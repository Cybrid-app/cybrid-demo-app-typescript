import { filter, interval, mergeMap, Observable, take, timeout } from 'rxjs';
import * as crypto from 'crypto';

const poll = (obs: Observable<any>, evalFunc: any, maxTime: number) => {
  return interval(1000).pipe(
    mergeMap(_ => obs),
    filter(val => evalFunc(val)),
    take(1),
    timeout({ each: maxTime })
  );
};

function generateRandomBase64(length: number): string {
  return crypto.randomBytes(length).toString('base64');
}

export { poll, generateRandomBase64 }
