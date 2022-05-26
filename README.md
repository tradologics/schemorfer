<img src="https://github.com/tradologics/schemorfer/blob/main/assets/logo.png?raw=true" height="72">

# The JSON Object Transformer

<a href="https://tradologics.com/opensource"><img alt="npm Version" src="https://img.shields.io/badge/By-Tradologics-7269a6"></a>
<a href="https://www.npmjs.com/package/@tradologics/schemorfer"><img alt="npm Version" src="https://badge.fury.io/js/%40tradologics%2Fschemorfer.svg"></a>
<a href="https://www.codefactor.io/repository/github/tradologics/schemorfer"><img alt="Code Factor" src="https://www.codefactor.io/repository/github/tradologics/schemorfer/badge"></a>
<a href="https://github.com/tradologics/schemorfer"><img alt="Star this repo" src="https://img.shields.io/github/stars/tradologics/schemorfer.svg?style=social&label=Star&maxAge=60"></a>
<a href="https://twitter.com/aroussi"><img alt="Follow me on" src="https://img.shields.io/twitter/follow/tradologics.svg?style=social&label=Follow&maxAge=60"></a>


**Schemorfer** is a JSON Schema transformation library.

It converts the source `JSON` structure to a different one, based on a supplied **map** `JSON` file, which contains instructions on how to convert each element.

Schemorfer also has the option to **validates** the schema against a valid e [JSON Schema](https://json-schema.org/understanding-json-schema/index.html) file. It uses [Ajv](https://github.com/ajv-validator/ajv) under the hood to validate, assign defaults to optional/empty properties, and remove empty properties from the source `JSON` data.

**Schemorfer** was developed by [Tradologics](https://tradologics.com) to convert various JSON payloads from various API providers into a standardized, pre-defined format.

## Install

```
$ npm install @tradologics/schemorfer
```

# Usage

```javascript
const schemorfer = require('@tradologics/schemorfer');

// option 1
const data = require('./post-payload.json');
const mapper = require('./post-mapper.json');
const newData = schemorfer.transform(data, mapper);

// option 2
// const newData = schemorfer.transform(
//     './post-payload.json', './post-mapper.json');

console.log(newData);
```


### Keywords

```
- $from = source key
- $default = default value (if empty, undefined, or null)
- $rename = array-based rename
- $if
    - $prop = the property to check against
    - $is (for true/false)
    - $typeof
    - $condition, either
        - $type = simple/const (default = simple)
        - $const = eval statement
- $then (required for if), either
    - $from = source key
    - $value = hard coded value
- $else, either
    - $from = source key
    - $value = hard coded value
- :: = nested source
- $apply - optional function to manipulate the value (`value` is passed as parameter)
```

`$apply` example:
```
{
  ...
  "$apply": "return value.toUpperCase()"
  ...
}
```
\* More docs coming soon 🙂

---

## JSON Schema Validation

```javascript
const schemorfer = require('schemorfer');

// option 1
const payload = require('./post-payload.json');
const schema = require('./post-schema.json');
const valid = schemorfer.validate(payload, schema);

// option 2
// const valid = schemorfer.validate(
//     './post-payload.json', './post-schema.json');

if (!valid) {
    console.error(schemorfer.errors());
}

// payload now has all the optional fields populated with the defaults
console.log(valid);
```

