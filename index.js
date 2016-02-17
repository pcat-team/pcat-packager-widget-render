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



var projectPath = fis.project.getProjectPath();

module.exports = function(ret, conf, settings, opt) {

    console.log(settings)

    var tagName = settings.tagName || "widget",
        outputPath = settings.outputPath || "../../_output";

    // 匹配组件标签
    var regString = "(<(" + tagName + "_\\d)([^>]+)*>)((.|\n)*)(<\\/\\2>)";

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

                var cache;

                var holder = "__PCAT_WIDGET__";

                // 暂时替换组件标签的内容，避免被渲染
                var _content = $4.replace(pattern, function(tag, $1, $2, $3, $4, $5, $6) {
                    cache = $4;

                    if (tag) return $1 + holder + $6;
                })

                // 渲染组件
                tag = _content.replace(propReg, function(prop, $1) {

                    return propsData[$1] || "";

                })

                // 恢复组件刚被替换的内容，继续递归渲染
                tag = tag.replace(holder, cache)


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

        var version = require(projectPath + "/../" + project + "/package.json").version;
        var media = fis.project.currentMedia() || "dev";

        // 跨系统获取资源依赖表
        var mapPath = projectPath + "/" + outputPath + "/" + media + "/map/" + project + "/" + version + "/map.json";


        var map = require(mapPath);

        return map;
    }

}
