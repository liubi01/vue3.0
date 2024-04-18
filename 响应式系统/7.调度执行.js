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
          fn();
          console.log('end');
          effectStack.pop();
          activeEffect = effectStack[effectStack.length - 1]
      }
      effectFn.deps = [];
      effectFn.options = options // 把如调度执行给与用户
      effectFn();
  }

  const bucket = new WeakMap();

  const data = {
      foo: 1,
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
      console.log("trigger");
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

  const jobQueue = new Set();
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

  effect(() => {
      console.log(obj.foo)
  }, {
      scheduler(fn) { // 控制副作用函数的调用时机和方式
          // 借助宏任务
          //   setTimeout(fn);
          //2 使用任务对垒多次tragger如（obj.foo++ ; obj.foo++）只需要执行一次副作用函数（使用set的去重能力）
          jobQueue.add(fn);
          flushJob();
      }
  });
  //   console.log("改变foo的值");
  obj.foo++ //
  obj.foo++ //

  console.log("改变foo的值结束");
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