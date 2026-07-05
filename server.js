const axios = require('axios');
const FormData = require('form-data');
const { config } = require('../config');

// Downloads the voice note Messenger gives us a URL for, then sends it to
// OpenAI's Whisper endpoint for transcription. Libyan dialect is not
// perfectly covered by Whisper (see note in project README), so we ask it
// to bias toward Arabic and accept that some messages will need the
// fallback "didn't catch that" reply — Claude is instructed to do this.
async function transcribeVoiceNote(audioUrl) {
  const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });

  const form = new FormData();
  form.append('file', Buffer.from(audioResponse.data), {
    filename: 'voice-note.mp4',
    contentType: 'audio/mp4',
  });
  form.append('model', 'whisper-1');
  form.append('language', 'ar'); // hint: Arabic (Whisper doesn't have a Libyan-specific code)

  const { data } = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      maxBodyLength: Infinity,
    }
  );

  return data.text?.trim() || '';
}

module.exports = { transcribeVoiceNote };
