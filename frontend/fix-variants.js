const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let content = fs.readFileSync(file, 'utf8');
            if (content.includes('variant="destructive"')) {
                let newContent = content.replace(/variant="destructive"/g, 'variant="error"');
                fs.writeFileSync(file, newContent, 'utf8');
                console.log("Updated: " + file);
            }
            if (content.includes("variant === 'destructive'")) {
                let newContent2 = content.replace(/variant === 'destructive'/g, "variant === 'error'");
                fs.writeFileSync(file, newContent2, 'utf8');
                console.log("Updated: " + file);
            }
            if (content.includes("variant === \"destructive\"")) {
                let newContent3 = content.replace(/variant === \"destructive\"/g, "variant === \"error\"");
                fs.writeFileSync(file, newContent3, 'utf8');
                console.log("Updated: " + file);
            }
        }
    });
    return results;
}

walk('./src');
