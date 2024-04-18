 // 全局变量存储被注册的副作用函数
 let activeEffect;
 const effectStack = [];
 const TriggerType = {
     SET: 'SET',
     ADD: 'ADD',
     DELETE: 'DELETE'
 }
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
     bar: 2
 }
 const ITERATE_KEY = Symbol('iterate key')
 const obj = new Proxy(data, {
     get(target, key, receiver) {
         track(target, key)
         return Reflect.get(...arguments)
     },
     set(target, key, value, receiver) {
         // 区分触发的set是添加属性还是set一个属性
         const type = Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD;
         Reflect.set(...arguments)
         trigger(target, key, type) // 把副作用函数取出并执行
         return true
     },
     // 如 ‘foo’ in obj;
     has(target, p) { // 拦截 in 操作符, in操作符内部最终调用了对象的[[HasProperty]]内部方法，该内部方法可以被Proxy的has拦截函数拦截
         track(target, p)
         return Reflect.has(target, p)
     },
     ownKeys(target) { // 拦截 for in 循环，只有target参数
         track(target, ITERATE_KEY) // ITERATE_KEY 特别带出的一个key for in 中特有
         return Reflect.ownKeys(target)
     },
     deleteProperty(target, key) {
         const hasKey = Object.prototype.hasOwnProperty.call(target, key);
         const res = Reflect.deleteProperty(target, key);
         if (res && hasKey) { // 只有是删除自有属性的时候，再触发trigger (for in中)
             trigger(target, key, 'DELETE') // delete是为了让trigger也触发for  in的副作用函数
         }

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

 function trigger(target, key, type) {
     const depsMap = bucket.get(target);
     if (!depsMap) return
     const effects = depsMap.get(key);
     const iterateEffects = depsMap.get(ITERATE_KEY)
     const effectsToRun = new Set();
     effects && effects.forEach(effectFn => {
         if (effectFn !== activeEffect) {
             effectsToRun.add(effectFn);
         }
     })
     if (type === TriggerType.ADD || type === TriggerType.DELETE) {
         iterateEffects && iterateEffects.forEach(effectFn => {
             if (effectFn !== activeEffect) {
                 effectsToRun.add(effectFn);
             }
         })
     }
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
     for (const key in obj) {
         console.log(key);
     }
 })

 console.log('改变我的值');
 //  obj.car = 3; // 新添属性触发set
 //  obj.foo = 3; // 修改已有属性
 //  delete obj.foo // 删除属性