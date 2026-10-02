export function chartWorker<T>(payload:Record<string,unknown>,onResult:(result:T)=>void,onError:(message:string)=>void){
  const worker=new Worker(new URL("./charts.worker.ts",import.meta.url),{type:"module"});
  const timer=window.setTimeout(()=>{worker.terminate();onError("Calculation took too long. Reduce the data or formula range and try again.");},15000);
  worker.onmessage=e=>{clearTimeout(timer);worker.terminate();e.data.error?onError(e.data.error):onResult(e.data.result);};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();onError(e.message||"The calculation worker failed.");};
  worker.postMessage({id:crypto.randomUUID(),...payload});
  return ()=>{clearTimeout(timer);worker.terminate();};
}
export function runChartWorker<T>(payload:Record<string,unknown>):Promise<T>{return new Promise((resolve,reject)=>chartWorker<T>(payload,resolve,message=>reject(new Error(message))));}
