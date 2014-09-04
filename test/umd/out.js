/*[global-shim]*/
(function (exports, global){
	var origDefine = global.define;

	var get = function(name){
		var parts = name.split("."),
			cur = global,
			i;
		for(i = 0 ; i < parts.length; i++){
			cur = cur[parts[i]];
		}
		return cur;
	};
	var modules = global.define && global.define.modules || {};
	var ourDefine = global.define = function(moduleName, deps, callback){
		var module;
		if(typeof deps === "function") {
			callback = deps;
			deps = [];
		}
		var args = [],
			i;
		for(i =0; i < deps.length; i++) {
			args.push( exports[deps[i]] ? get(exports[deps[i]]) : modules[deps[i]]  );
		}
		// CJS has no dependencies but 3 callback arguments
		if(!deps.length && callback.length) {
			module = { exports: {} };
			var require = function(name) {
				return exports[name] ? get(exports[name]) : modules[name];
			};
			args.push(require, module.exports, module);
		}

		global.define = origDefine;
		var result = callback ? callback.apply(null, args) : undefined;
		global.define = ourDefine;

		// Favor CJS module.exports over the return value
		modules[moduleName] = module && module.exports ? module.exports : result;
	};
	global.define.modules = modules;
	global.System = {
		define: function(__name, __code){
			eval(__code);
		}
	};
})({},window)
/*common*/
define('common', function(require, exports, module) {module.exports = "works"
});
/*amd*/
define('amd', ['common'], function (cjs) {
    return {
        amd: 'works',
        cjs: cjs
    };
});
/*main*/
define('main', ['amd'], function (amd) {
    return {
        steal: 'works',
        amd: amd
    };
});
