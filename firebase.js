var admin = require("firebase-admin");
const { envs } = require("./constants/envs");

const serviceAccount = {
    type: envs.firebase.type,
    project_id: envs.firebase.project_id,
    private_key_id: envs.firebase.private_key_id,
    private_key: envs.firebase.private_key,
    client_email: envs.firebase.client_email,
    client_id: envs.firebase.client_id,
    auth_uri: envs.firebase.auth_uri,
    token_uri: envs.firebase.token_uri,
    auth_provider_x509_cert_url: envs.firebase.auth_provider_x509_cert_url,
    client_x509_cert_url: envs.firebase.client_x509_cert_url,
    universe_domain: envs.firebase.universe_domain,
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

module.exports = admin;