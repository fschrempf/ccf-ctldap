var fs = require("fs");
var ini = require("ini");
var path = require("path");

exports.config = ini.parse(
  fs.readFileSync(path.resolve(__dirname, "ctcaldap.config"), "utf-8")
);

const ldap = require("ldapjs");
const server = ldap.createServer();

server.search("o=example", (req, res, next) => {
  const obj = {
    dn: req.dn.toString(),
    attributes: {
      objectclass: ["organization", "top"],
      o: "example",
    },
  };
});

var rootobj = {
  dn: "dc=ccfreiburg,dc=de",
  attributes: {
    createtimestamp: "20200406114647Z",
    creatorsname: "cn=admin,dc=ccfreiburg,dc=de",
    dc: "ccfreiburg",
    entrycsn: "20200406114647.018289Z#000000#000#000000",
    entrydn: "dc=ccfreiburg,dc=de",
    entryuuid: "0a0f7af6-0c48-103a-873b-5963809e173f",
    hassubordinates: true,
    modifiersname: "cn=admin,dc=ccfreiburg,dc=de",
    modifytimestamp: "20200406114647Z",
    o: "Calvary Chapel Freiburg",
    objectclass: ["top", "organization"],
    structuralobjectclass: "organization",
    subschemasubentry: "cn=Subschema",
  },
};

server.search("o=example", (req, res, next) => {
  const obj = {
    dn: "o=example",
    attributes: {
      objectclass: ["organization", "top", "dcObject"],
      o: "example",
      hasSubordinates: true,
    },
  };
  if (req.filter.matches(obj.attributes)) res.send(obj);
  res.end();
});
server.search("oc=top, cn=Subschema", (req, res, next) => {
  const obj = {
    dn: "oc=top, cn=Subschema",
    attributes: {
      parentTo: "all",
    },
  };
  if (req.filter.matches(obj.attributes)) res.send(obj);
  res.end();
});

server.search("", (req, res) => {
  obj = rootobj;
  if (req.filter.matches(obj.attributes)) res.send(obj);
  res.end();
});

server.listen(1389, () => {
  console.log("LDAP server listening at %s", server.url);
});

if (this.config.sites) {
  Object.keys(this.config.sites).map((sitename) => {
    var site = config.sites[sitename];
    console.log(site + " Setting site config");
  });
}
