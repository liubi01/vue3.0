function deepClone(target, cache = new WeakMap()) {
    // 1. 判断是否为基本数据类型
    if (typeof target !== 'object' || target === null) return target; // 直接返回基本数据类型
    // 2. 判断是否已经被克隆过，防止循环引用
    if (cache.has(target)) return cache.get(target);   
     // 3. 创建克隆对象（区分数组和对象）
    let cloneTarget = Array.isArray(target) ? [] : {};
   
    if(target instanceof Array){
        for(let i = 0; i < target.length; i++) {
           cloneTarget[i] = deepClone(target[i], cache);     
        }
    }else if(target instanceof Map) { // Map数据格式为键值对    
        cloneTarget = new Map();
        for(const [key,value] of target) {
            cloneTarget.set(deepClone(key,cache),deepClone(value,cache));
        }
    }else if(target instanceof Set) {
        cloneTarget = new Set();
        for(value of target) {
            cloneTarget.add(deepClone(value,cache));
        }
    }else if(target instanceof Date) {
        cloneTarget = new Date(target.getTime());
    }else if(target instanceof RegExp) {
        cloneTarget = new RegExp(target.source, target.flags); // a
    }else if(target instanceof Function) {
        cloneTarget = function(...args) {
            return target.apply(this,args); //这个this执行时的调用者
        }
    }else if(target instanceof Error) {
        cloneTarget = new target.constructor(target.message);
    }else {
        // 普通对象的克隆
        const keys = Reflect.ownKeys(target); // 获取所有类型的键 包括不可枚举和symbol
        const proto = Object.getPrototypeOf(target);
        cloneTarget = Object.create(proto); // 👈 关键：保留原型
        for(key of keys){
             // ✅ 正确跳过协议属性
            if (key === 'constructor' || 
                key === Symbol.iterator || 
                key === Symbol.toStringTag) {
                continue;
            }
            // if(['contructor',Symbol,Symbol.iterator,Symbol.toStringTag].includes(key)) continue  //target中包含了这几个非合理的属性的化
            cloneTarget[key] = deepClone(target[key],cache)
        }

    }
    cache.set(target,cloneTarget)
    return cloneTarget
}