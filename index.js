var path = require("path");

var projectPath = fis.project.getProjectPath();

//匹配标签的属性和值 k=v
var prostr = /(\S+)\s*\=\s*("[^"]*")|('[^']*')/gi;
// 获取属性对象
function getPropsObj(props) {
    var obj = {};

    if (props) {
        var propsArr = props.trim().match(prostr);

        obj = require("querystring").parse(propsArr.join("&").replace(/["']/g, ""));

    }

    return obj;
}

function extend(target, object) {
    for (var x in object) {
        target[x] = object[x];
    }
}

//匹配{{val}}
var propReg = /{{([^{}]+)}}/gmi;


module.exports = function(ret, conf, settings, opt) {

    var tagName = settings.tagName,
        mapOutputPath = settings.mapOutputPath,
         packageOutputPath = settings.packageOutputPath;


    // 匹配组件标签
    var regString = "(<(" + tagName + "_\\d+)([^>]+)*>)((.|\\n|\\r)*)(<\\/\\2>)";

    var pattern = new RegExp(regString, "gim");


    var res = ret.map["res"];

    // 已存在的项目
    var project = {};

    Object.keys(res).forEach(function(key, index) {
        var namespace = key.split(":")[0];
        project[namespace] = true;
    });


    // 合并跨项目资源表
    Object.keys(res).forEach(function(key, index) {
        var id = res[key];

        if (id.extras && id.extras.isPage) {
            comboMap(id["deps"]);
        }
    });

    // 组件渲染
    fis.util.map(ret.src, function(subpath, file) {
        if (file.isPage) {

            var content = render(file.getContent());

            file.setContent(content);

        }
    })



    function render(content) {

        content = content.replace(pattern, function(tag, $1, $2, $3, $4, $5, $6) {

            if (tag) {
                var propsData = getPropsObj($3);

                var cache = {};

                var holder = "__PCAT_WIDGET__",
                    count = 0;

                // 暂时替换组件标签的内容，避免被渲染
                var _content = $4.replace(pattern, function(tag, $1, $2, $3, $4, $5, $6) {
                    var _holder = holder + (count++);
                    cache[_holder] = $4;
                    return $1 + _holder + $6;

                })

                // 渲染组件
                tag = _content.trim().replace(propReg, function(prop, $1) {

                    var keys = $1.trim().split(/\s*\|\|\s*/);

                    var value = '';

                    for(var i=0,len=keys.length; i<len; i++){

                        var val = keys[i];
                      
                        value = propsData[val];

                        if(value) break;


                        // string
                        var match = val.match(/^['"](.+)['"]$/);

                        if(match && match[1]){
                            value = match[1];
                            break;
                        }


                        // Number
                        if(/^\d+$/.test(val)){
                            value = val;
                            break;
                        }

                    }

                    return value || "";

                })


                // 恢复组件刚被替换的内容，继续递归渲染

                Object.keys(cache).forEach(function(key, index) {
                    tag = tag.replace(key, cache[key])
                });


                return render(tag);
            }

        })

        return content;
    }


    function comboMap(deps) {
        deps && deps.forEach(function(dep, index) {

            var namespace = dep.split(":")[0];

            if (project[namespace]) return;

            // 跨系统获取资源依赖表
            var ohterDeps = requireOhteProjectDeps(namespace, dep);

            extend(res, ohterDeps["res"]);

            project[namespace] = true;

        })
    }




    // 获取其他系统的依赖表
    function requireOhteProjectDeps(project, dep) {


        var media = fis.project.currentMedia() || "dev";

        var version = getProjectVersion(project);

        // 解析跨系统资源依赖表路径
        var mapPath = path.resolve(mapOutputPath, project, version, "map.json");


        if (!fis.util.exists(mapPath)) {
            fis.log.error('unable to load map.json [%s]', mapPath)
        }

        // 获取跨系统获取资源依赖表
        var map = require(mapPath);

        return map;
    }

    // 获取指定项目的版本
    function getProjectVersion(project) {


        var packagePath = path.resolve(packageOutputPath, project, "package.json");

        if (!fis.util.exists(packagePath)) {
            fis.log.error('unable to load package.json [%s]', packagePath)
        }

        var version = require(packagePath).version;

        return version;
    }

}
