const Fs = require('fs')
const Path = require('path')
const ShEx = require('@shexjs/core')
const Ns_fh = 'http://hl7.org/fhir/'
const Ns_fhsh = 'http://hl7.org/fhir/shape/'
const Ns_rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const StupidBaseUrl = r => `http://uu3.org/fhir/${r}-R4-jsonld-1.1-context.jsonld`
const DTRegExp = RegExp('^(http://hl7.org/fhir/shape/[a-z]|http://www.w3.org/2001/XMLSchema#)')

function readFiles(dirname, onFileContent, onError) {
  Fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    var i = 0;
    var j = 0;
    filenames.forEach(function(filename) {
      Fs.readFile(dirname + filename, 'utf-8', function(err, content) {
        if (err) {
            j++;
          onError(err);
          return;
        }
        console.log("Content found for " + (++i) + ". " + filename);
        onFileContent(filename, content);
      });
    })
    console.log("Errors in " + j + " files.");
    ;
  });
}

var data = {};
readFiles('C:\\A123\\git\\Deepak\\FHIR\\fhir_rdf_validator\\tests\\cache\\', function(filename, content) {
  //data[filename] = content;

  const s = JSON.parse(content);
  const c = new Converter(s)
  const selected = process.argv.slice(2)
  const todo = s.shapes.map(
    shexpr => ({ shexpr, name: shexpr.id.substr(Ns_fhsh.length)})
  ).filter(
    pair => selected.length
      ? selected.indexOf(pair.name) !== -1 // specific subset to serialize
      : !pair.name.match(/\./) // all that aren't nested shapes
  )
  todo.forEach(pair => {
    const res = c.convert(pair.shexpr)
    console.log(pair.name, '################################\n', JSON.stringify(res, null, 2))
    Fs.writeFileSync(Path.join('build', pair.name), JSON.stringify(res, null, 2))
  })
}, function(err) {
  throw err;
});

class Converter {

  constructor (schema) {
    this.schema = schema
  }

  convert (shexpr) {
    const ret = {
      '@context': Object.assign({
        '@version': 1.1,
        '@vocab': 'http://janeirodigital.github.io/nhs-care-plan/flat-FHIR.ttl#',
        'xsd': 'http://www.w3.org/2001/XMLSchema#' ,
        'fhir': 'http://hl7.org/fhir/',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      }, this.visit(shexpr.expression)) // this.lookup(from)
    }
    return ret
  }

  lookup (label) {
    const found = this.schema.shapes.find(e => e.id === label)
    if (!found) {
      report(Error(`${label} not found`))
      return null
    }
    if (!("expression" in found))
      report(Error(`${label} has no expression`))
    return found.expression
  }

  visit (expr) {
      if (!expr)
        return;
    console.log("Expression:" + expr);
    switch (expr.type) {
    case 'OneOf':
    case 'EachOf':
      return Object.assign.apply({}, expr.expressions.map(e => this.visit(e)))
    case 'TripleConstraint':
      const {id, attr} = shorten(expr.predicate)
      if (id === 'fhir:nodeRole')
        return {}
      if (id === 'rdf:type')
        return { "resourceType": { "@id": "rdf:type" , "@type": "@id" } }
      const ret = { }
      ret[attr] = { '@id': id }
      if (expr.predicate !== Ns_rdf + 'type' /* || typeof expr.valueExpr === 'string' */) {
        // if (expr.valueExpr.match(DTRegExp))
        //   ret[attr]['@type'] = expr.valueExpr
        if (typeof expr.valueExpr === 'object')
          ret[attr]['@type'] = expr.valueExpr.datatype
        else if (expr.valueExpr.substr(Ns_fhsh.length).match(/\./))
          ret[attr]['@context'] = this.visit(this.lookup(expr.valueExpr))
        else
          ret[attr]['@context'] = StupidBaseUrl(expr.valueExpr.substr(Ns_fhsh.length))
      }
      return ret
    default:
      throw Error('what\'s a ' + JSON.stringify(expr))
    }
  }

}

function shorten (p) {
  if (p === Ns_rdf + 'type')
    return {id: 'rdf:type', attr: 'resourceType'}
  const pairs = [{prefix: 'fhir', ns: Ns_fh},
                 {prefix: 'rdf', ns: Ns_rdf}]
  return pairs.reduce((acc, pair) => {
    if (!p.startsWith(pair.ns))
      return acc
    const localName = p.substr(pair.ns.length) // .replace(/[a-zA-Z]+\./, '')
    const n = pair.prefix + ':' + escape(localName)
    return acc.id === null || n.length < acc.id.length ? {id: n, attr: localName} : acc
  }, {id: null, attr: null})
}

function escape (localName) {
  return localName
}