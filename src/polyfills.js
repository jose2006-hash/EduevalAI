// Polyfills para Safari/iOS antiguos (requeridos por pdf.js)
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Map.prototype.getOrInsertComputed !== 'function') {
  Map.prototype.getOrInsertComputed = function getOrInsertComputed(key, callbackfn) {
    if (this.has(key)) return this.get(key);
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof WeakMap.prototype.getOrInsertComputed !== 'function') {
  WeakMap.prototype.getOrInsertComputed = function getOrInsertComputed(key, callbackfn) {
    if (this.has(key)) return this.get(key);
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}
