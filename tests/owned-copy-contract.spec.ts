import {test,expect} from '@playwright/test';
import {EventEmitter} from 'node:events';
import {startOwnedCopy} from '../src/game/owned-copy';

for(const result of ['resolve','reject','throw','cancel','shutdown','retire'] as const)
  test(`owned clipboard request releases its event owner after ${result}`,async()=>{
    const events=new EventEmitter(),completed:boolean[]=[],canceled:string[]=[];
    let current=true,resolve!:(value:boolean)=>void,reject!:(error:Error)=>void;
    const promise=new Promise<boolean>((yes,no)=>{resolve=yes;reject=no;});
    const operation=startOwnedCopy({events,scene:{isActive:()=>true}} as never,{
      isCurrent:()=>current,
      write:()=>{if(result==='throw')throw new Error('Unavailable');return promise;},
      complete:value=>completed.push(value),canceled:()=>canceled.push('retired'),
    });
    expect(events.listenerCount('shutdown')).toBe(1);
    if(result==='cancel')operation.cancel();
    if(result==='shutdown')events.emit('shutdown');
    if(result==='retire')current=false;
    if(result==='reject')reject(new Error('Denied'));else resolve(true);
    await Promise.resolve();await Promise.resolve();
    expect(events.listenerCount('shutdown')).toBe(0);
    expect(operation.isCurrent()).toBe(false);
    expect(completed).toEqual(result==='resolve'?[true]:['reject','throw'].includes(result)?[false]:[]);
    expect(canceled).toEqual(['cancel','shutdown','retire'].includes(result)?['retired']:[]);
    operation.cancel();events.emit('shutdown');
    expect(canceled.length).toBeLessThanOrEqual(1);
  });
