  // 全局变量存储被注册的副作用函数
  let activeEffect;
  const effectStack = [];
  // effect 函数用于注册副作用函数
  function effect(fn, options) {
      const effectFn = () => {
          console.log('start');
          cleanup(effectFn);
          activeEffect = effectFn;
          effectStack.push(effectFn)
          // 有了lazy后可以通过自调用副作用函数 获取其返回值

          const res = fn();
          console.log('end');
          effectStack.pop();
          activeEffect = effectStack[effectStack.length - 1]
          return res;
      }
      effectFn.deps = [];
      effectFn.options = options // 把如调度执行给与用户
      if (!options.lazy) {
          effectFn();
      }
      // 副作用函数返回值
      return effectFn;
  }

  const bucket = new WeakMap();

  const data = {
      foo: 1,
      bar: 5
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
      console.log('track start');
      if (!activeEffect) return target[key]
      console.log('track');
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
      console.log("trigger", key);
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
          if (effectFn.options.scheduler) {
              effectFn.options.scheduler(effectFn);
          } else {
              effectFn();
          }
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

  // 通过lazy来实现computed的计算属性
  // 任何一次获取obj.value的值时都将调用effectfn 这显然是会重复计算性能损耗 加入dirty
  function computed(getter) {
      let value;
      let dirty = true;
      const effectFn = effect(getter, {
          lazy: true,
          scheduler() {
              // 对应的双绑数据改变后 出发trigger二执行schedule 设置dirty为true
              dirty = true;
              trigger(obj, value);
          },
      })
      const obj = {
          get value() {
              if (dirty) {
                  value = effectFn();
                  dirty = false;
              }
              track(obj, value); // 触发时机在获取obj.value时 get.value的自动执行后
              return value;
          }
      }
      return obj;
  }
  // 给每一个obj的key都注册副作用函数，值修改后执行自定义的副作用函数（cb） ,source可以是函数也可以是对象
  // 使用lazy来放回 newValue 和 oldValue
  function watch(source, cb) {
      //  
      let getter;
      if (typeof source === 'function') {
          getter = source;
      } else {
          getter = () => traverse(source);
      }
      let newValue, oldValue;
      const effectFn = effect(getter, {
          lazy: true,
          scheduler() {
              newValue = effectFn();
              cb(newValue, oldValue);
              oldValue = newValue;
          }
      })
      oldValue = effectFn();
  }

  // 递归读取value的每一个值 目的是为了每个值都通过触发track
  function traverse(value, seen = new Set()) {
      if (typeof value !== 'object' || value === null || seen.has(value)) return;
      seen.add(value)
      for (const k in value) {
          traverse(value[k], seen);
      }
      return value;
  }
  const jobQueue = new Set(); // 一个去重数组
  const p = Promise.resolve();

  // 代表是否正在刷新队列
  let isFlushing = false;

  function flushJob() {
      if (isFlushing) return;
      isFlushing = true;
      p.then(() => {
          jobQueue.forEach(job => {
              job();
          })
      }).finally(() => {
          isFlushing = false;
      })
  }
  // const effect = function () {
  //     document.body.innerText = obj.text
  // }
  // effect()
  let tmp1, tmp2
  //   watch(obj, (nVal, oVal) => {
  //       console.log('值改变了', nVal, oVal);
  //   })
  watch(() => obj.foo, (nVal, oVal) => {
      console.log('值改变了', nVal, oVal);
  })
  console.log("改变foo的值结束");
  obj.foo++;
  //   const effectFn = effect(() => {
  //       console.log(obj.foo)
  //   }, {
  //       scheduler(fn) { // 控制副作用函数的调用时机和方式
  //           // 借助宏任务
  //           //   setTimeout(fn);
  //           //2 使用任务对垒多次tragger如（obj.foo++ ; obj.foo++）只需要执行一次副作用函数（使用set的去重能力）
  //           jobQueue.add(fn);
  //           flushJob();
  //       },
  //       lazy: true
  //   });
  //   console.log(effectFn()); // 等同于 computed
  //   const res = computed(() => {
  //       return obj.foo + obj.bar
  //   })
  //   console.log(res.value);
  //   obj.foo++;
  //   console.log(res.value);
  //   console.log("改变foo的值");
  //   obj.foo++ //
  //   obj.foo++ //

  //  effect(() => {
  //     obj.foo++
  //  })
  //   setTimeout(() => {

  //   obj.foo = 'hello vue3'  //
  //   obj.bar = 'hello vue3'  //
  // obj.ok = true
  // obj.text1 = 'text1'
  //   }, 1000)
  // setTimeout(() => {
  //     obj.ok = false
  //     // obj.text1 = 'text1'
  // }, 3000)