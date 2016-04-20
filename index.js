var path = require("path");

var projectPath = fis.project.getProjectPath();

var curProject = path.basename(projectPath);

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

                    for (var i = 0, len = keys.length; i < len; i++) {

                        var val = keys[i];

                        value = propsData[val];

                        if (value) break;


                        // string
                        var match = val.match(/^['"](.+)['"]$/);

                        if (match && match[1]) {
                            value = match[1];
                            break;
                        }


                        // Number
                        if (/^\d+$/.test(val)) {
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



    // 合并common资源表
    comboMap();

    function comboMap() {
        // common 自身不需要合并
        if (curProject == "common") return;

        //合并资源依赖表 
        var curMap = ret.map["res"];

        // 跨系统获取资源依赖表
        var commonMap = requireCommonMap().res;

        extend(curMap, commonMap);

    }

    // 获取其他系统的依赖表
    function requireCommonMap() {


        var media = fis.project.currentMedia() || "dev";


        // 解析跨系统资源依赖表路径
        var mapPath = path.resolve(mapOutputPath, "common", "map.json");


        if (!fis.util.exists(mapPath)) {
            fis.log.error('找不到common系统的map.json，尝试先编译common子系统[%s]', mapPath)
        }

        // 获取跨系统获取资源依赖表
        var map = require(mapPath);

        return map;
    }



}
