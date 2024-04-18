 // 全局变量存储被注册的副作用函数
 let activeEffect;
 const effectStack = [];
 // effect 函数用于注册副作用函数
 function effect(fn) {
     const effectFn = () => {
         cleanup(effectFn);
         activeEffect = effectFn;
         effectStack.push(effectFn)
         fn();
         effectStack.pop();
         activeEffect = effectStack[effectStack.length -1]
     }
     effectFn.deps = [];
     effectFn();
 }

 const bucket = new WeakMap();

 const data = {
     foo: true,
     bar: true
 }
 const obj = new Proxy(data, {
     get(target, key) {
         track(target, key);
         return target[key]
     },
     set(target, key, newVal) {
         target[key] = newVal
         trigger(target, key);
         return true;
     }
 })

 function track(target, key) {
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
     const effectsToRun = new Set(effects);
     effectsToRun.forEach(effectFn => {
         effectFn();
     })
     // effects && effects.forEach(effectFn => {
     //     console.log('trigger',key,effectFn);
     //     effectFn();
     // });
 }

 function cleanup(effectFn) {
     for (let index = 0; index < effectFn.deps.length; index++) {
         const deps = effectFn.deps[index];
         deps.delete(effectFn);
     }
     effectFn.deps.length = 0;
 }
 // const effect = function () {
 //     document.body.innerText = obj.text
 // }
 // effect()
 // effect(() => {
 //     document.body.innerText = obj.ok ? obj.text : 'not '
 // });
 let tmp1, tmp2
 effect(() => {
     console.log('eff1执行')
     effect(() => {
         console.log('eff2执行')
         tmp2 = obj.bar
     })
     console.log("eff1执行end");
     tmp1 = obj.foo
 })
 setTimeout(() => {
     console.log("改变foo的值");
     obj.foo = 'hello vue3'  //
     obj.foo = 'hello vue3'  //
     obj.bar = 'hello vue3'  //
     // obj.ok = true
     // obj.text1 = 'text1'
 }, 1000)
 // setTimeout(() => {
 //     obj.ok = false
 //     // obj.text1 = 'text1'
 // }, 3000)