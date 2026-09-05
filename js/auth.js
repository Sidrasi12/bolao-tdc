Bolao.Auth = {
  user: null,
  registering: false,

  cleanName(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
  },

  async loadOrCreateProfile(firebaseUser) {
    const ref = Bolao.db.collection('users').doc(firebaseUser.uid);
    let snapshot = await ref.get();

    if (!snapshot.exists) {
      await ref.set({
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        role: 'player',
        active: true,
        paid: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      snapshot = await ref.get();
    }

    return snapshot.data();
  },

  buildUser(firebaseUser, profile) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: profile.name || firebaseUser.displayName || firebaseUser.email.split('@')[0],
      role: profile.role || 'player',
      active: profile.active !== false,
      paid: profile.paid === true,
      emailVerified: firebaseUser.emailVerified
    };
  },

  async init() {
    const config = BOLAO_CONFIG.firebase;

    if (config.apiKey === 'COLE_AQUI') {
      Bolao.App.toast('Configure o Firebase antes de publicar');
      return Bolao.App.showAuth();
    }

    firebase.initializeApp(config);
    Bolao.db = firebase.firestore();
    Bolao.fbAuth = firebase.auth();

    Bolao.fbAuth.onAuthStateChanged(async firebaseUser => {
      if (!firebaseUser) {
        this.user = null;
        return Bolao.App.showAuth();
      }

      if (this.registering) return;

      try {
        const profile = await this.loadOrCreateProfile(firebaseUser);
        this.user = this.buildUser(firebaseUser, profile);
        Bolao.App.enter(this.user);
      } catch (error) {
        console.error('Erro ao carregar o perfil:', error);
        Bolao.App.toast('Erro ao carregar o perfil: ' + error.message);
      }
    });
  },

  login(email, password) {
    return Bolao.fbAuth.signInWithEmailAndPassword(email.trim(), password);
  },

  async register(name, email, password) {
    const cleanName = this.cleanName(name);

    if (cleanName.length < 2) {
      throw new Error('Informe um nome com pelo menos 2 caracteres.');
    }

    this.registering = true;

    try {
      const result = await Bolao.fbAuth.createUserWithEmailAndPassword(
        email.trim(),
        password
      );

      await result.user.updateProfile({ displayName: cleanName });

      const profile = {
        email: result.user.email,
        name: cleanName,
        role: 'player',
        active: true,
        paid: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await Bolao.db.collection('users').doc(result.user.uid).set(profile);

      this.user = this.buildUser(result.user, profile);
      Bolao.App.enter(this.user);
      return result;
    } finally {
      this.registering = false;
    }
  },

  resetPassword(email) {
    return Bolao.fbAuth.sendPasswordResetEmail(email.trim());
  },

  async updateName(name) {
    const cleanName = this.cleanName(name);
    if (cleanName.length < 2) throw new Error('Informe um nome com pelo menos 2 caracteres.');

    const firebaseUser = Bolao.fbAuth.currentUser;
    if (!firebaseUser) throw new Error('Sessão expirada. Entre novamente.');

    await Bolao.db.collection('users').doc(firebaseUser.uid).update({
      name: cleanName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await firebaseUser.updateProfile({ displayName: cleanName });

    this.user.name = cleanName;
    document.querySelector('#user-name').textContent = cleanName;
  },

  async updatePassword(currentPassword, newPassword) {
    const firebaseUser = Bolao.fbAuth.currentUser;
    if (!firebaseUser) throw new Error('Sessão expirada. Entre novamente.');

    const credential = firebase.auth.EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword
    );
    await firebaseUser.reauthenticateWithCredential(credential);
    await firebaseUser.updatePassword(newPassword);
  },

  logout() {
    return Bolao.fbAuth.signOut();
  }
};
