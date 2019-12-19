# spfmt
A reformatter of SPARQL written in JS

## Usage for Web Browser

* Download spfmt_bundled.js and load it in your HTML.

```
<script src="/js/spfmt_bundled.js"></script>
```

* Then you can use `spfmt.reformat`
```javascript
spfmt.reformat("SELECT * WHERE {?s ?p ?o}");
/*
SELECT *
WHERE {
    ?s ?p ?o .
}
*/
```

* You can also call spfmt through the jsDelivr service
```
    <textarea id="sparql-text" rows=5></textarea>
    <button id="reformat-button">Reformat</button>
    <textarea id="sparql-text-after" rows=5></textarea>
    
    <script src="https://cdn.jsdelivr.net/gh/hchiba1/sparql-utils@master/spfmt/src/spfmt_bundled.js"></script>  
    <script type="text/javascript">
     window.onload = () => {
         var textArea = 
             document.querySelector("#reformat-button").addEventListener('click', (event) => {
                 document.querySelector("#sparql-text-after").value =
                     spfmt.reformat(document.querySelector("#sparql-text").value);
             });
     };
    </script>
```
## Usage from Command line

### Requirements
- Node.js (>= 11.0.0)
- npm (>= 6.12.0)

### Installation
```
$ npm install
$ npm link
```

### Usage
```
$ cat messy.rq 
SELECT * WHERE         {         ?s ?p ?o }

$ spfmt messy.rq 
SELECT *
WHERE {
    ?s ?p ?o .
}
```

### Test
```
$ ./node_modules/mocha/bin/mocha
```

### Update spfmt_bundled.js
Update the spfmt_bundled.js as follows after editing any other JS codes
```
$ ./node_modules/browserify/bin/cmd.js src/spfmt_browser.js > src/spfmt_bundled.js 
```
