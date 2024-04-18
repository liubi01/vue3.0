 // 全局变量存储被注册的副作用函数
 let activeEffect;
 const effectStack = [];
 // effect 函数用于注册副作用函数
 function effect(fn) {
     const effectFn = () => {
         console.log('effect start');
         cleanup(effectFn);
         activeEffect = effectFn;
         effectStack.push(effectFn)
         fn();
         console.log('effect end');
         effectStack.pop();
         activeEffect = effectStack[effectStack.length - 1]
     }
     effectFn.deps = [];
     effectFn();
 }

 const bucket = new WeakMap();

 const data = {
     foo: 1,
     get bar() {
         return this.foo
     },
     set bar(v) {
         this.foo += v
     }
 }

 const obj = new Proxy(data, {
     get(target, key, receiver) {
         track(target, key)
         return Reflect.get(...arguments)
     },
     set(target, key, value, receiver) {
         Reflect.set(...arguments)
         trigger(target, key) // 把副作用函数取出并执行
         return true
     }
 })

 function track(target, key) {
     console.log('track');
     if (!activeEffect) return target[key]
     let depsMap = bucket.get(target);
     if (!depsMap) {
         bucket.set(target, (depsMap = new Map()));
     }
     let deps = depsMap.get(key);
     if (!deps) {
         depsMap.set(key, (deps = new Set()))
     }
     deps.add(activeEffect);
     activeEffect.deps.push(deps);
 }

 function trigger(target, key) {
     const depsMap = bucket.get(target);
     if (!depsMap) return
     const effects = depsMap.get(key);
     const effectsToRun = new Set();
     effects.forEach(effectFn => {
         if (effectFn !== activeEffect) {
             effectsToRun.add(effectFn);
         }
     })
     effectsToRun.forEach(effectFn => {
         effectFn();
     })

 }

 function cleanup(effectFn) {
     for (let index = 0; index < effectFn.deps.length; index++) {
         const deps = effectFn.deps[index];
         deps.delete(effectFn);
     }
     effectFn.deps.length = 0;
 }



 effect(() => {
     console.log('effect!!')
     console.log(obj.bar)
 })