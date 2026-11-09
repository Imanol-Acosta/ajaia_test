import { expect, it } from 'vitest'
import { importText } from './documents'

it('imports UTF-8 and blank lines while keeping markup-like text literal', async () => {
  const draft = await importText(new File(['\ufeff Café\r\n\r\n<b>notes</b>\rNext\n'], ' Field notes.TXT'))
  expect(draft).toEqual({
    title: 'Field notes',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: ' Café' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '<b>notes</b>' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Next' }] },
        { type: 'paragraph' },
      ],
    },
  })
})
