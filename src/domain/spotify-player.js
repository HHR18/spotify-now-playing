'use strict';
require('../sentry');
const { ipcMain } = require('electron');
const localStorage = require('../data-source/local-storage');
const spotifyDataSource = require('../data-source/spotify-datasource');
const mappers = require('../helpers/mappers');
const errorReporter = require('../helpers/error-reporter');
const authorizer = require('./authorizer');
const { UPDATE_PERIOD } = require('../helpers/constants');

ipcMain.on('previousButtonClicked', () => spotifyDataSource.previousTrack(localStorage.get('accessToken')));
ipcMain.on('nextButtonClicked', () => spotifyDataSource.nextTrack(localStorage.get('accessToken')));
ipcMain.on('pauseButtonClicked', () => spotifyDataSource.pause(localStorage.get('accessToken')));
ipcMain.on('playButtonClicked', () => spotifyDataSource.play(localStorage.get('accessToken')));
ipcMain.on('addToLibraryClicked', (event, uri) => {
  const accessToken = localStorage.get('accessToken');
  spotifyDataSource.addTrackToLibrary(accessToken, uri);
});

exports.execute = function(parentWindow) {
  ipcMain.on('addToPlaylistButtonClicked', handleAddToPlaylistButtonClicked);
  ipcMain.on('playlistSelected', (event, data) => handlePlaylistSelected(data));

  setInterval(() => getCurrentPlayback(), UPDATE_PERIOD);
  
  function getCurrentPlayback() {
    const accessToken = localStorage.get('accessToken');

    spotifyDataSource.getCurrentPlayback(accessToken)
      .then(json => {
        if(json.item) {
          const mappedData = mappers.currentPlaybackToView(json);
          sendToRendererProcess('currentPlaybackReceived', mappedData);
        } else {
          sendToRendererProcess('loading', {});
          authorizer.execute(parentWindow);
        }
      })
      .catch(error => {
        errorReporter.emit('getCurrentPlayback', error);
        sendToRendererProcess('noContent');
      });
  }

  function sendToRendererProcess(channel, data) {
    parentWindow.webContents.send(channel, data);
  }

  function handleAddToPlaylistButtonClicked() {
    const accessToken = localStorage.get('accessToken');
    spotifyDataSource.getPlaylists(accessToken)
      .then(data => {
        const mappedData = mappers.playlistsToView(data);
        sendToRendererProcess('playlistsReceived', mappedData);
      })
      .catch(error => errorReporter.emit('getPlaylists', error));
  }

  function handlePlaylistSelected(data) {
    const accessToken = localStorage.get('accessToken');
    const { playlistId, uri } = data;
    spotifyDataSource.addTrackToPlaylist(accessToken, playlistId, uri)
      .then(response => response.error ? authorizer.execute(parentWindow) : sendToRendererProcess('trackAdded'))
      .catch(error => errorReporter.emit('addTrackToPlaylist', error));
  }
};
