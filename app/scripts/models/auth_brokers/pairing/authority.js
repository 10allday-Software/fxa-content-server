/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Manages the OAuth flow by webchannel messages to the browser,
// to help with a pairing-based flow.

import AuthorityStateMachine from '../../pairing/authority-state-machine';
import OAuthAuthenticationBroker from '../oauth';
import setRemoteMetaData from './remote-metadata';

export default class AuthorityBroker extends OAuthAuthenticationBroker {
  type = 'authority';

  initialize (options) {
    super.initialize(options);

    const {  notifier } = options;

    this.stateMachine = new AuthorityStateMachine({}, {
      broker: this,
      //channelServerClient: this.channelServerClient,
      notifier,
      relier: this.relier
    });


    this.setCapability('requirePasswordToPair', false);
  }

  fetch () {
    return Promise.resolve()
      .then(() => super.fetch())
      .then(() => this.getSupplicantMetadata())
      .then(() => this.startHeartbeat());
  }

  startHeartbeat () {
    this._heartbeatInterval = setInterval(() => this.heartbeat(), 1000);
  }

  stopHeartbeat () {
    clearInterval(this._heartbeatInterval);
  }

  heartbeat () {
    this.request(this._notificationChannel.COMMANDS.PAIR_HEARTBEAT)
      .then(response => {
        console.log('heartbeat response', response);
        if (response.err) {
          this.stateMachine.heartbeatError(response.err);
        } else if (response.suppAuthorized) {
          console.log('supp is authorized');
          this.notifier.trigger('pair:supp:authorize');
        }
      });
  }

  _provisionScopedKeys() {
    throw new Error('this should never be called');
  }

  getSupplicantMetadata() {
    const remoteMetaData = this.get('remoteMetaData');
    if (remoteMetaData) {
      return Promise.resolve(remoteMetaData);
    }

    return this.request(this._notificationChannel.COMMANDS.PAIR_REQUEST_SUPPLICANT_METADATA)
      .then((response) => {
        this.setRemoteMetaData(response);
        console.log('supplicantMetaData', response);
        this.set('confirmationCode', response.confirmation_code);
        return this.get('remoteMetaData');
      });
  }

  setRemoteMetaData = setRemoteMetaData;

  /*
  sendOAuthResultToRelier ({ code, state }) {
    return this.send(this._notificationChannel.COMMANDS.PAIR_AUTHORIZE, { code, state });
  }

  getOAuthResult(account, options = {}) {
    return Promise.resolve().then(() => {
      const keysJwe = this.get('keysJwe');
      if (keysJwe) {
        return keysJwe;
      }

      return this.request(this._notificationChannel.COMMANDS.PAIR_REQUEST_KEYS_JWE);
    }).then(response => {
      this.set({ keysJwe: response.keys_jwe });

      options.keysJwe = response.keys_jwe;
      return super.getOAuthResult(account, options);
    });
  }
*/
  afterPairAuthAllow (account) {
    return this.send(this._notificationChannel.COMMANDS.PAIR_AUTHORIZE)
      .then(() => {
        this.notifier.trigger('pair:auth:authorize');
      });
  }

  afterPairAuthDecline () {
    return this.send(this._notificationChannel.COMMANDS.PAIR_DECLINE);
  }

  request(message, data = {}) {
    return Promise.resolve().then(() => {
      data.channel_id = this.relier.get('channelId'); //eslint-disable-line camelcase

      console.log('request', message, data);
      // TODO - can we get a reference to the WebChannel directly?
      return this._notificationChannel.request(message, data);
    });
  }

  send (message, data = {}) {
    return Promise.resolve().then(() => {
      data.channel_id = this.relier.get('channelId'); //eslint-disable-line camelcase

      console.log('send', message, data);
      return this._notificationChannel.send(message, data);
    });
  }
}