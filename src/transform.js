const ldapEsc = require('ldap-escape');
const c = require('./constants');
const crypto = require('crypto');

class DataFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataFormatError';
  }
}
exports.lowercase = (s) => (typeof s === 'string' ? s.toLowerCase() : s);
exports.identity = (s) => s;
exports.stringConvLowercaseUmlaut = (str) => {
  return str
    .toLowerCase()
    .replace('ö', 'oe')
    .replace('ä', 'ae')
    .replace('ü', 'ue')
    .replace('ß', 'ss');
};
exports.generateUUID = () => {
  return crypto.randomUUID();
};

exports.uniqueEmails = (users) => {
  var mails = {};
  return users.filter((user) => {
    if (!user.attributes.email) {
      return false;
    }
    var result = !(user.attributes.email in mails);
    mails[user.attributes.email] = true;
    return result;
  });
};

exports.getRootObj = (dc, admin, o) => {
  var dn = dc;
  //ldapEsc.dn`cn=root`;
  return {
    users: {
      dn: "ou="+c.LDAP_OU_USERS+","+dc,
      attributes: {
        o: o,
        ou: c.LDAP_OU_USERS,
        cn: c.LDAP_OU_USERS,
        elements: [],
      }
    },
    groups: {
      dn: "ou="+c.LDAP_OU_GROUPS+","+dc,
      attributes: {
        o: o,
        ou: c.LDAP_OU_GROUPS,
        cn: c.LDAP_OU_GROUPS,
        elements: [],
      }
    },
    dsn: {
      dn: dc,
      attributes: {
        creatorsname: admin,
        entrydn: dc,
        entryuuid: this.generateUUID(),
        o: o,
        namingContexts: [ dc ],
        objectclass: ['top', 'RootDSE', 'organization'],
        structuralobjectclass: 'organization',
        subschemasubentry: 'cn=Subschema',
      }
    }
  };
};

exports.getAdmin = (cn, dc) => {
  const dn = ldapEsc.dn`cn=${cn}` + ',' + dc;
  return {
    dn: dn,
    attributes: {
      cn: cn,
      displayname: 'Admin',
      id: 0,
      uid: 'Admin',
      bbbrole: 'admin',
      entryUUID: '',
      givenname: 'Administrator',
      objectclass: [
        c.LDAP_OBJCLASS_USER,
        'simpleSecurityObject',
        'organizationalRole',
      ],
    },
  };
};

exports.setUid = (ctpserson) => {
  if (ctpserson[c.LDAPID_FIELD] && ctpserson[c.LDAPID_FIELD].length > 0)
    return ctpserson[c.LDAPID_FIELD];
  return t.stringConvLowercaseUmlaut(
    ctpserson.firstName + '.' + ctpserson.lastName
  );
};

exports.addConfigAttributes = (ctperson, attributes) => {
  attributes.forEach((attribute) => {
    ctperson.attributes[attribute.name] = attribute.default;
    const replacment = attribute.replacements.find(
      (rep) => rep.id == ctperson.attributes.id
    );
    if (replacment) ctperson.attributes[attribute.name] = replacment.value;
  });
};

exports.transformUser = (ctpserson, attributes, dc) => {
  result = {};
  if (!ctpserson || !ctpserson.id)
    throw new DataFormatError('Empty user object');

  var cn = this.setUid(ctpserson);
  var dn = ldapEsc.dn`cn=${cn}` + ',ou=' + c.LDAP_OU_USERS + ',' + dc;
  result = {
    dn: this.lowercase(dn),
    attributes: {
      cn: cn,
      id: ctpserson.id,
      displayname: ctpserson.firstName + ' ' + ctpserson.lastName,
      uid: cn,
      entryUUID: ctpserson.guid,
      givenname: ctpserson.firstName,
      street: ctpserson.lastName,
      telephoneMobile: ctpserson.mobile,
      telephoneHome: ctpserson.phonePrivate,
      postalCode: ctpserson.zip,
      l: ctpserson.city,
      sn: ctpserson.lastName,
      email: this.lowercase(ctpserson.email),
      mail: this.lowercase(ctpserson.email),
      objectclass: [c.LDAP_OBJCLASS_USER,"person","organizationalPerson","user"],
      memberof: [],
    },
  };
  this.addConfigAttributes(result, attributes);
  return result;
};

exports.trsansformGroup = (ctgroup, grtransform, dc) => {
  if (!ctgroup || !ctgroup.id)
    throw new DataFormatError('Group from CT was emtpy');
  var cn = grtransform && grtransform.name ? grtransform.name : ctgroup.name;
  var dn = ldapEsc.dn`cn=${cn}` + ',ou=' + c.LDAP_OU_GROUPS + ',' + dc;
  return {
    dn: this.lowercase(dn),
    attributes: {
      cn: cn,
      displayname: cn,
      id: ctgroup.id,
      guid: ctgroup.guid,
      nsuniqueid: 'g' + ctgroup.id,
      objectclass: [c.LDAP_OBJCLASS_GROUP],
      uniquemember: [],
    },
  };
};

exports.connectUsersAndGroups = (
  memberships,
  groups,
  users,
  tranformedGroups
) => {
  groups.forEach((group) => {
    const objClassGrpMem = tranformedGroups.find(
      (t) => t.gid == group.attributes.id
    );
    memberships
      .filter((m) => m.groupId == group.attributes.id)
      .forEach((memberhip) => {
        const user = users.find((u) => u.attributes.id == memberhip.personId);
        if (user) {
          user.attributes.memberof.push(group.dn);
          if (objClassGrpMem && objClassGrpMem.hasOwnProperty('objectClass'))
            user.attributes.objectclass.push(objClassGrpMem.objectClass);
          group.attributes.uniquemember.push(user.dn);
        }
      });
  });
};

exports.getLdapGroupsWithoutMembers = (ctgroups, tranformedGroups, dc) => {
  const groups = [];
  ctgroups.forEach((element) => {
    grptransform = tranformedGroups.find((t) => t.gid == element.id);
    const grp = this.trsansformGroup(element, grptransform, dc);
    groups.push(grp);
  });
  return groups;
};

exports.getLdapUsers = (ctpersons, attributes, dc) => {
  const users = [];
  ctpersons.forEach((element) => {
    const user = this.transformUser(element, attributes, dc);
    users.push(user);
  });
  return users;
};

exports.getLdapDataFromChurchTools = (site, churchtoolsdata) => {
  const groups = this.getLdapGroupsWithoutMembers(
    churchtoolsdata.groups,
    site.tranformedGroups,
    site.ldap.dc
  );
  const users = this.getLdapUsers(
    churchtoolsdata.persons,
    site.attributes,
    site.ldap.dc
  );
  this.connectUsersAndGroups(
    churchtoolsdata.memberships,
    groups,
    users,
    site.tranformedGroups
  );
  return {
    users,
    groups,
  };
};
