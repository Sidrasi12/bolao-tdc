# Atualização Firestore da versão multiusuário

Antes de publicar, preserve o `js/firebase-config.js` que já funciona no GitHub.

Publique estas regras no Firestore:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
    function isAdmin() { return signedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }
    match /users/{uid} {
      allow create: if isOwner(uid);
      allow read: if signedIn();
      allow update: if isAdmin() || (isOwner(uid) && request.resource.data.role == resource.data.role);
      allow delete: if isAdmin();
    }
    match /weeklyPredictions/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }
    match /preseasonPredictions/{id} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin() || (signedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }
    match /manualResults/{id} { allow read: if signedIn(); allow write: if isAdmin(); }
    match /settings/{id} { allow read: if signedIn(); allow write: if isAdmin(); }
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Instalação

1. Não envie o `firebase-config.js` deste pacote.
2. Mantenha no GitHub o `firebase-config.js` atual, que contém sua configuração real.
3. Substitua os demais arquivos.
4. Publique as regras acima.
5. Teste um palpite e confirme a criação de `weeklyPredictions` no Firestore.
