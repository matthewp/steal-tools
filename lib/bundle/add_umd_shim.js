
module.exports = function(bundle, options) {
	

};

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([], function (){
			return factory();
        });
    } else {
        root.amdWebGlobal = factory(root.b);
    }
}(this, function (b) {
    return {};
}));
