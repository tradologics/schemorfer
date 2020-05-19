# Schemorfer - The JSON Schema Transformer


**Schemorfer** is a JSON Schema transformation library.
I allows the conversion from one JSON structure to another using a mapping `.json` file.


### What it does:

1. **Validate** - Schemorfer uses [Ajv](https://github.com/ajv-validator/ajv) under the hood to validate [JSON Schema](https://json-schema.org/understanding-json-schema/index.html), assign defaults to optional/empty properties, and remove empty properties from the `json` data.

2. **Transform** - Schemorfer converts the source `json` structure to a different one, based on a supplied **mapping** instructions file.


## Install

```
$ npm install @tradologics/schemorfer
```

# Usage

## Validate


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


## Transform

```javascript
const schemorfer = require('schemorfer');

// option 1
const data = require('./post-payload.json');
const schema = require('./post-mapper.json');
const newData = schemorfer.transform(data, mapper);

// option 2
// const newData = schemorfer.transform(
//     './post-payload.json', './post-mapper.json');

console.log(newData);
```

### Keywords

```
- from = source key (required)
- default = default value (if empty, undefined, or null)
- rename = array-based rename
- if
    - prop
    - is
    - typeof
    - condition
        - type = simple/const (default = simple)
        - const = eval statement
- then (required for if)
    - from = source key
    - value = hard coded value
- else
    same as then
- :: = nested
```
