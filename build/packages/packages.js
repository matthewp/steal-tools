var readFile = require("../../node/utils").readFile;

// open all apps
// go through and mark everything in 'core' as packaged

// indicate which sub-packages each other app needs
// steal({ id: 'packagea', needs: 'abc.js'})

// TODO
//  - make it able to work with specific files

if(!steal.build){
	steal.build = {};	
}
steal('steal',
	'steal-tools/build/share',
	'./do_all.js',
	'steal-tools/node/utils.js',
	'steal-tools/build/open',
	'steal-tools/build/apps',
	'steal-tools/rhino/json.js',
	function(s, share, doAll){

	var apps = s.build.apps,
		build = s.build,
		buildTypes = steal.build,
		js = steal.build.js,
		packages =
	
	/**
	 * @function steal.build.packages
	 * @parent steal.build
	 *
	 * @signature `steal.build.packages(app[, buildOptions])`
	 * @param {Object} app
	 * @param {Object} buildOptions
	 * @param {Function} callback
	 *
	 * @body
	 * 
	 * Builds an app, and pulls out packages
	 * 
	 */
	s.build.packages = function(app, buildOptions, callback){
		
		// options for packaging
		var options = {
			// the files opened
			files : {},
			// each app's first file
			appFiles : [],
			// don't minify at first (will be faster)
			minify : false,
			// Allow modifying the location of steal.js
			stealDir: buildOptions.stealDir
		};
		buildOptions = buildOptions || {};
		buildOptions.depth = buildOptions.depth || Infinity;
		buildOptions.stealOwnModules = true
		// open the core app
		apps._open(app, options, function(options, opener){
			
			// the folder are build files will go in
			var to = buildOptions.to || ""+s.URI(opener.firstSteal.options.id).dir(),
				appNamesToName = {},
				usedNames = {},
				// a helper function that translates between an 
				// app's name and where we are building it to
				appNamesToMake = function(appNames){
					
					//remove js if it's there
					appNames = appNames.map(function(appName){
						return (appName+"").replace(".js","")
					});
					var expanded = appNames.join('-');
					// check map
					if(appNamesToName[expanded]){
						return appNamesToName[expanded];
					}
					// try with just the last part
					var shortened = appNames.map(function(l){
						return s.URI(l).filename()
					}).join('-');
					
					if(!usedNames[shortened]){
						usedNames[shortened] = true;
						return appNamesToName[expanded] = to + "/packages/"+shortened;
					} else {
						return appNamesToName[expanded] = to + "/packages/"+expanded.replace(/\//g,'_') ;
					}
				},
				filterCode = function(code, type, cb) {
					if(buildOptions.minify) {
						buildTypes[type].minify(code, { compressor: buildOptions.compressor }, cb);
					} else {
						setTimeout(function(){ cb(code); }, 0);
					}
				};
			
			// make the packages folder
			s.URI(to+"/packages").mkdirs();
			
			// get packages loaded, packages need to be rootSrc style url
			var packs = opener.steal.packages(),
				// will house the master app's files (so we can build them later)
				masterFiles = [];
				
			// go through every file and mark it packaged
			for(var name in options.files){
				options.files[name].packaged = true;
				masterFiles.push(options.files[name])
			}
			
			// Make the packaged!
			// TODO: figure out how to not write it needs this
			
			// change options for loading packages
			// we don't want to change pages, use the current page
			options.newPage = false;
			
			// minify each file we load
			options.minify = false;
			
			// open packages and add their dependencies 
			apps.open(packs, options, function(options){
				
				// order files 
				apps.order(options);
				
				var sharing,
					// makes contains an hash of packageSrc to
					// the object that we will pass to steal.p.make
					// like:
					//  {
					//    package1 : {id: package1, needs: [shared1]}
					//  }
					// this is used so when the package is stolen,
					// it will load anything it needs before it
					makes = {},
					// mappings of packaged app name to packaging file
					// this is what overwrites the loading location for packages
					maps = {},
					// a list of shares, we go through the list twice
					// b/c it is easier to populate makes
					// once we have gone through each share.
					shares = [];
				
				
				while(sharing = apps.getMostShared(options.files)){
					shares.push(sharing);
				};
				
				packages.flatten(shares, buildOptions.depth);
				
				if( shares.length ) {
					s.print("\nBuilding packages");
				} else {
					s.print("  no packages\n")
				}

				if(shares.length) {
					buildPackages(0, doAll.after(handleDepth, doBuild));
				} else {
					doAll(handleDepth, doBuild);
				}

				function buildPackages(shareIndex, cb){		
					// Check if we have completed the operation.
					if(shareIndex == shares.length) {
						return cb();
					}

					var sharing = shares[shareIndex];
						
					// is it a 'end' package
					var isPackage = sharing.appNames.length == 1,
						packageName = appNamesToMake(sharing.appNames);
	
					// create package
					js.makePackage(sharing.files.map(function(f){
							return f.stealOpts;
						}), {}, packageName+".css", buildOptions, function(pack){
						
						var hasCSS = pack.css
							, has = [];
					
					
						// 
						if(isPackage){
							s.print("  Package: "+packageName+ (hasCSS ? " js/css" : "" ) )
						} else {
							s.print("  Shared Package: "+packageName+ (hasCSS ? " js/css" : "" ))
						}
						
						sharing.files.forEach(function(f){
							s.print("  + "+f.stealOpts.id)
							if(f.stealOpts.buildType == 'js'){
								has.push(f.stealOpts.id+'')
							}
						})
						s.print(" ")

						filterCode(pack.js, 'js', function(filteredJs){
							s.URI(packageName+".js").save( filteredJs );
							
							// make this steal instance
							makes[packageName+".js"] = {
								id: packageName+".js",
								needs :[],
								has : has
							}
							// if we have css
							if(hasCSS){
								// write
								// tell the js it needs this css
								makes[packageName+".js"].needs.push(packageName+".css")
								// make the css
								makes[packageName+".css"] = {
									id: packageName+".css",
									has: pack.css.srcs
								};

								filterCode(pack.css.code, 'css', function(filteredCss){
									s.URI(packageName+".css").save( filteredCss );
									sharing.hasCSS = true;
									doAll(addToMaps, complete);
								});
							} else {
								doAll(addToMaps, complete);
							}

							function addToMaps(){
								// add to maps
								if(isPackage){
									// this should be the real file
									maps[""+s.id(sharing.appNames[0])] = packageName+".js";
								}
							}

							// Called internally when all operations are complete.
							function complete(){
								shareIndex++;
								buildPackages(shareIndex, cb);
							}
						});
					});

				}
		
				// handle depth
				function handleDepth(){
				
					shares.forEach(function(sharing){
						var isPackage = sharing.appNames.length == 1,
							sharePackageName = appNamesToMake(sharing.appNames);
						
						if(!isPackage){
							// add this as a needs to master
							sharing.appNames.forEach(function(appName){
								var packageName = appNamesToMake([appName])
								makes[packageName+".js"].needs
									.push(sharePackageName+".js")
								
								// add css
								if(sharing.hasCSS){
									makes[packageName+".js"].needs
										.push(sharePackageName+".css")
								}
								// also needs css!
								
							})
						}
					});

				}


				// write production with makes
				// and maps
				function doBuild() {
					// sort masterFiles
					buildOptions.to = buildOptions.to || ""+s.URI(app).dir();
					var destJS = ''+steal.URI(buildOptions.to).join('production.js'),
						destCSS = ''+steal.URI(buildOptions.to).join('production.css');
					s.print("Building "+destJS);
					
					js.makePackage(
						masterFiles.map(function(f){return f.stealOpts}),
						{}, destCSS, buildOptions, function(pack){
					
						// prepend maps and makes ...
						// make makes
						var makeCode = [],
							mapCode, stealCode;
						for(name in makes) {
							makeCode.push("steal.make(",
								JSON.stringify(makes[name]),
								");")
						}
						mapCode = "steal.packages("+JSON.stringify(maps)+");";
						stealCode = buildOptions.packageSteal ? readFile("steal/steal.js") : "";

						filterCode(stealCode+mapCode+makeCode.join('\n')+"\n"+pack.js, 'js', function(filteredJs){

							s.URI(destJS).save( filteredJs );
							if(pack.css){
								s.print("         "+destCSS);

								filterCode(pack.css.code, 'css', function(filteredCss){
									s.URI(destCSS).save( filteredCss );
									callback();
								});
							} else {
								callback();
							}
						});
					});
				}
			});
		});
	};

	s.extend(packages,share);
	var p = packages;

	return packages;
});
