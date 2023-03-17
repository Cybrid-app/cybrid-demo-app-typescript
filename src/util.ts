import {filter, interval, mergeMap, Observable, take, timeout} from 'rxjs';

const poll = (obs: Observable<any>, evalFunc: any, maxTime: number) => {
  return interval(1000).pipe(
    mergeMap(_ => obs),
    filter(val => evalFunc(val)),
    take(1),
    timeout({each: maxTime})
  );
};

export {poll};
