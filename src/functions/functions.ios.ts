import * as firebase from "../firebase";
import { firebaseUtils } from '../utils';
import { HttpsCallable } from './functions';


function getFunctions(region?: firebase.firebaseFunctions.SupportedRegions): FIRFunctions {
  return region ? FIRFunctions.functionsForRegion(region) : FIRFunctions.functions();
}

export function httpsCallable<I = {}, O = {}>(functionName: string, region?: firebase.firebaseFunctions.SupportedRegions): HttpsCallable<I, O> {
  const functions = getFunctions(region);

  return (data: I) => new Promise((resolve, reject) => {

    const callable = functions.HTTPSCallableWithName(functionName);

    const handleCompletion = (result: FIRHTTPSCallableResult, err: NSError) => {
      if (err) {
        reject(err.localizedDescription);
        return;
      }

      if (result) {
        resolve(firebaseUtils.toJsObject(result.data) as O);
      }
    };

    if (data) {
      callable.callWithObjectCompletion(data, handleCompletion);
    } else {
      callable.callWithCompletion(handleCompletion);
    }
  });
}

export function useFunctionsEmulator(origin: string): void {
  const functions = getFunctions();
  functions.useFunctionsEmulatorOrigin(origin);
}
