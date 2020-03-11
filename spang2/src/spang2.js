#!/usr/bin/env node

fs = require('fs');

const version = require("../package.json").version;
const child_process = require('child_process');
const search_db_name = require('./search_db_name');
const prefixModule = require('./prefix.js');
const shortcut = require('./shortcut.js').shortcut;
const constructSparql = require('./construct_sparql.js').constructSparql;
const querySparql = require('./query_sparql.js');


toString = (resource) => {
  if(resource.type == 'uri') {
    if(commander.abbr) return prefixModule.abbreviateURL(resource.value);
    return `<${resource.value}>`;
  } else if(resource.type == 'typed-literal') {
    if(commander.abbr) return `"${resource.value}"^^${prefixModule.abbreviateURL(resource.datatype)}`;
    return `"${resource.value}"^^<${resource.datatype}>`;
  } else {
    return `"${resource.value}"`;
  }
}

debugPrint = (object) => {
  console.log(JSON.stringify(object, undefined, 2));
};


var db, sparqlTemplate, localMode;
var parameterMap = {};
var retrieveByGet = false;

var commander = require('commander').version(version)
    .option('-f, --format <FORMAT>', 'tsv, json, n-triples (nt), turtle (ttl), rdf/xml (rdfxml), n3, xml, html', 'tsv')
    .option('-e, --endpoint <ENDPOINT>', 'target endpoint')
    .option('-S, --subject <SUBJECT>', 'shortcut to specify subject')
    .option('-P, --predicate <PREDICATE>', 'shortcut to specify predicate')
    .option('-O, --object <OBJECT>', 'shortcut to specify object')
    .option('-F, --from <FROM>', 'shortcut to search FROM specific graph (use alone or with -[SPOLN])')
    .option('-N, --number', 'shortcut of COUNT query (use alone or with -[SPO])')
    .option('-G, --graph', 'shortcut to search Graph names (use alone or with -[SPO])')
    .option('-a, --abbr', 'abbreviate results using predefined prefixes')
    .option('-q, --show_query', 'show query and quit')
    .option('-L, --limit <LIMIT>', 'LIMIT output (use alone or with -[SPOF])')
    .option('-l, --list_nick_name', 'list up available nicknames and quit')
    .option('--param <PARAMS>', 'parameters to be embedded (in the form of "--param par1=val1,par2=val2,...")')
    .arguments('<SPARQL_TEMPLATE>').action((s) => {
      sparqlTemplate = s;
    });

commander.parse(process.argv);


if(commander.list_nick_name) {
  console.log('SPARQL endpoints');
  const dbMap = search_db_name.listup();
  const maxLen = Object.keys(dbMap).map(key => key.length).reduce((a, b) => Math.max(a, b));
  for(const entry in dbMap) {
    console.log(` ${entry.padEnd(maxLen, ' ')} ${dbMap[entry].url}`);
  }
  process.exit(0);
}

if(commander.args.length < 1 &&
   (!commander.subject && !commander.predicate && !commander.object && !commander.number && !commander.from && !commander.graph && !commander.limit || !commander.endpoint)) {
  commander.help();
}


if(commander.param) {
  params = commander.param.split(',');
  params.forEach((par) => {
    [k, v] = par.split('=');
    parameterMap[k] = v;
  });
}

if(commander.subject || commander.predicate || commander.object || commander.limit ||
   commander.number || commander.graph || commander.from) {
  sparqlTemplate = shortcut({S: commander.subject, P: commander.predicate, O: commander.object,
                             L: commander.limit, N: commander.number, G: commander.graph, F: commander.from}, prefixModule.getPrefixMap());
  metadata = {};
} else {
  [sparqlTemplate, metadata] = constructSparql(fs.readFileSync(sparqlTemplate, 'utf8'), parameterMap);
}

if(commander.show_query) {
  console.log(sparqlTemplate);
}
else if(localMode) {
  console.log(child_process.execSync(`sparql --data ${db} --results ${commander.format} '${sparqlTemplate}'`).toString());
} else {
  if(commander.endpoint)
  {
    db = commander.endpoint;
  } else if(metadata.endpoint) {
    db = metadata.endpoint;
  } else {
    console.log('endpoint is required');
    process.exit(-1);
  }

  if(/^\w/.test(db)) {
    if (!(/^(http|https):\/\//.test(db))) {
      [db, retrieveByGet] = search_db_name.searchDBName(db);
    }
  } else {
    localMode = true;
    if (db == '-') {
      db = fs.readFileSync(process.stdin.fd, "utf8");
    } else if(!fs.existsSync(db)) {
      console.log(`${db}: no such file`);
      process.exit(-1);
    }
  }
  querySparql(db, sparqlTemplate, commander.format, (error, response, body) => {
    if (!error && response.statusCode == 200) {
      if(commander.format == 'tsv') {
        const obj = JSON.parse(body);
        const vars = obj.head.vars;
        obj.results.bindings.forEach(b => {
          console.log(vars.map(v => toString(b[v])).join("\t"));
        });
      } else {
        console.log(body);
      }
    } else {
      console.log('error: '+ response.statusCode);
      console.log(body);
    }
  });
}
