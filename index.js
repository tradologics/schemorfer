/**
 * Schemorfer - The JSON Schema Transformer
 * https://github.com/tradologics/schemorfer
 *
 * Copyright 2022 Tradologics, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const fs = require('fs');
const Ajv = require('ajv');
// const { X509Certificate } = require('crypto');

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, useDefaults: true });

let source = {}, used = [], newjson = {};

const safeEval = (code, context) => {
    const x = new Function(Object.keys(context).join(','), code);
    return x(Object.values(context).join(','));
};

const asArray = (item) => {
    if (item === undefined) return [];
    return Array.isArray(item) ? item : [item];
};

class SchemorferMapError extends Error {
    constructor(validationErrors) {
        super();
        this.name = 'SchemorferMapError';
        this.message = validationErrors;
    }
}

const getChildProperty = (item, prop, fallback) => {
    if (item.hasOwnProperty(prop)) {
        return item[prop];
    }
    return fallback;
};


const getProperty = (item, prop, fallback) => {
    if (prop.indexOf('::') === -1) {
        return getChildProperty(item, prop, fallback);
    }

    return safeEval("source." + prop.replace('::', '.'), {
        "source": source
    });

};

const hasProperties = (mapper) => {
    // check if has properties not starting with `$`
    const mapperKeys = Object.keys(mapper);

    let hasprops = false;
    mapperKeys.forEach(key => {
        if (key.charAt(0) != "$") {
            hasprops = true;
        }
    });
    return hasprops;
};


function* iterate(mapper) {
    const mapperKeys = Object.keys(mapper);
    for (let i = 0; i < mapperKeys.length; i++) {
        const key = mapperKeys[i];
        yield [key, mapper[key], hasProperties(mapper[key])];
    }
    return;
}


const looper = (mapper, obj) => {

    for (const [key, val, nested] of iterate(mapper)) {

        // object
        if (nested) {
            obj[key] = JSON.parse(JSON.stringify(val).replace(/{"\$\w+":"(.*?)"}/g, 'null'));
            looper(val, obj[key]);
        }
        else {
            if (val.hasOwnProperty('$from')) {
                used.push(val.$from.split('::')[0]);
            }
            let res = parser(key, val);
            if (res !== undefined) {
                obj[key] = res;
            }
        }
    }
};

const parser = (key, val) => {

    let output;

    // from & default
    if (val.hasOwnProperty('$from')) {
        output = getProperty(source, val.$from, getProperty(val, "$default"));
    } else if (val.hasOwnProperty('$default')) {
        output = val.$default;
    }

    // if/then/else
    if (val.hasOwnProperty('$if')) {
        // if (!val.hasOwnProperty('$then')) {
        //     throw new SchemorferMapError(`"${key}": $if requires presence of $then.`);
        // }

        if (!Array.isArray(val.$if)) {
            val.$if = [val.$if];
        }
        let isTrues = [];

        val.$if.forEach(condition => {
            if (!condition.hasOwnProperty('$from')) {
                throw new SchemorferMapError(`"${key}": $if requires a $from child.`);
            }
            if (!condition.hasOwnProperty('$is') &&
                !condition.hasOwnProperty('$typeof') &&
                !condition.hasOwnProperty('$condition')) {
                throw new SchemorferMapError(`"${key}": $if requires either $is, $typeof, or $condition child.`);
            }

            const from = getProperty(source, condition.$from, getProperty(val, "$default"));

            if (condition.hasOwnProperty('$is')) {
                isTrues.push(asArray(condition.$is).includes(from));
            }

            else if (condition.hasOwnProperty('$typeof')) {
                isTrues.push((from !== null) && (typeof from == condition.$typeof));
            }

            else if (condition.hasOwnProperty('$condition')) {

                if (!condition.$condition.hasOwnProperty('$const')) {
                    throw new SchemorferMapError(`"${key}": $if.$condition requires $const child.`);
                }
                const conditionType = getProperty(condition.$condition, "$type", "simple");

                if (conditionType == "simple") {
                    isTrues.push(safeEval("from " + condition.$condition.$const, { "from": from }));
                }
                else if (conditionType == "from") {
                    let prop = condition.$condition.$const.split(/(=|<|>| |\*\/|\^|%|\++|\-+)/).slice(-1).pop();
                    let propValue = getProperty(source, prop);
                    let cond = condition.$condition.$const.replace(prop, typeof propValue == "string" ? `'${propValue}'` : propValue);
                    isTrues.push(safeEval("from " + condition, { "from": from, "cond": condition }));
                }
            }
        });

        isTrues = new Set(isTrues);
        const isTrue = isTrues.size == 1 && isTrues.has(true);

        if (!val.hasOwnProperty('$then')) {
            output = isTrue;
        }
        else if (isTrue) {
            output = (Object.keys(val.$then)[0] == "$from") ? getProperty(source, val.$then.$from) : val.$then.$value;
        }
        else if (val.hasOwnProperty('$else')) {
            output = (Object.keys(val.$else)[0] == "$from") ? getProperty(source, val.$else.$from) : val.$else.$value;
        }
        // else {
        //     output = null;
        // }
    }

    // rename
    if (val.hasOwnProperty('$rename')) {
        const source = getProperty(val.$rename, '$source');
        const target = getProperty(val.$rename, '$target');
        if (!source || !target) {
            throw new SchemorferMapError(`"${key}": $rename requires both $source and $target.`);
        }
        else if (source.length != target.length) {
            throw new SchemorferMapError(`"${key}": $rename $source and $target length don't match.`);
        }

        for (let i = 0; i < source.length; i++) {
            if (output == source[i]) {
                output = output.replace(source[i], target[i]);
                break;
            }
        }
    }

    if (output && val.hasOwnProperty('$apply')) {
        try {
            output = safeEval(val.$apply, { "value": output });
        } catch(er){}
    }

    return output;
};


const transform = (data, mapper, options) => {

    options = options || {};
    let config = {
        mergeUnmapped: getProperty(options, 'mergeUnmapped', false),
        keepNulls: getProperty(options, 'keepNulls', true),
    };

    source = {};
    used = [];
    newjson = {};

    if (typeof data == "string") {
        data = JSON.parse(fs.readFileSync(data));
    }
    if (typeof mapper == "string") {
        mapper = JSON.parse(fs.readFileSync(mapper));
    }

    if (!mapper.hasOwnProperty("$map")) {
        throw new SchemorferMapError("Mapper object must have a `$map` property.");
    }

    mapper = mapper.$map;
    source = data;

    looper(mapper, newjson);

    // cleanup:
    if (!config.keepNulls) {
        newjson = JSON.stringify(newjson);
        newjson = newjson.replace(/{"\w+":null}/gm, null);
        newjson = newjson.replace(/(,?)"\w+":null(,?)/gm, ',');
        newjson = newjson.replace(',}', '}');
        newjson = JSON.parse(newjson);
    }

    if (config.mergeUnmapped) {
        let orphans = {};
        used = [...new Set(used)];
        const reduced = Object.keys(data).filter((el) => !used.includes(el));
        reduced.forEach(item => {
            let val = data[item];
            if (item != "constructor" && val) {
                orphans[item] = val;
            }
        });

        newjson = { ...orphans, ...newjson };
    }

    return newjson;
};


let errors = [], errorsText = "";
const validate = (data, schema) => {

    if (typeof data == "string") {
        data = JSON.parse(fs.readFileSync(data));
    }
    if (typeof schema == "string") {
        schema = JSON.parse(fs.readFileSync(schema));
    }

    errors = [];
    errorsText = "";

    let valid = ajv.validate(schema, data);
    if (!valid) {
        errors = ajv.errors;
        errorsText = ajv.errorsText();
    }

    return valid;
};


module.exports = {

    errors: () => { return errors; },
    errorsText: () => { return errorsText; },

    transform: transform,
    validate: validate
};

