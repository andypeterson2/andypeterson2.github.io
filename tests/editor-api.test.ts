import { vi, describe, test, expect, beforeEach } from 'vitest';
import { CvApi } from '../src/editor/lib/api';

// A minimal Response stand-in for the mocked global fetch.
function respond(status: number, body?: unknown, json = true, statusText = '') {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? (json ? 'application/json' : 'text/plain') : null,
    },
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

const api = () => new CvApi('https://test.example/cv');

describe('CvApi.req — the request envelope', () => {
  test('a 200 JSON response resolves ok with the data, credentialed', async () => {
    fetchMock.mockResolvedValue(respond(200, { status: 'ok', service: 'cv' }));
    const res = await api().health();
    expect(res).toEqual({ ok: true, status: 200, data: { status: 'ok', service: 'cv' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.example/cv/api/health',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  test('401 / 403 collapse to a single auth_required error', async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValue(respond(status));
      const res = await api().listPersons();
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe('auth_required');
    }
  });

  test('a non-ok response with an error body surfaces that error verbatim', async () => {
    fetchMock.mockResolvedValue(respond(400, { error: { code: 'bad_request', message: 'nope' } }));
    const res = await api().listPersons();
    expect(res.error).toEqual({ code: 'bad_request', message: 'nope' });
  });

  test('a non-ok response without an error body synthesizes http_<status>', async () => {
    fetchMock.mockResolvedValue(respond(500, {}, true, 'Server Error'));
    const res = await api().listPersons();
    expect(res.status).toBe(500);
    expect(res.error?.code).toBe('http_500');
  });

  test('a thrown fetch becomes a network_error carrying the message', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const res = await api().health();
    expect(res.status).toBe(0);
    expect(res.error).toEqual({ code: 'network_error', message: 'offline' });
  });

  test('a non-JSON 200 yields no data (never tries to parse it)', async () => {
    fetchMock.mockResolvedValue(respond(204, undefined, false));
    const res = await api().listPersons();
    expect(res.ok).toBe(true);
    expect(res.data).toBeUndefined();
  });

  test('a write sends JSON with the Content-Type header; a read sends none', async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 1 }));
    await api().createPerson('Ada');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.example/cv/api/persons');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ada' });

    fetchMock.mockResolvedValue(respond(200, { persons: [] }));
    await api().listPersons();
    expect(fetchMock.mock.calls[1][1].headers).toBeUndefined(); // GET → no content-type
  });
});

describe('CvApi.fetchPerson / fetchActive', () => {
  test('fetchPerson maps the raw main record into the editor Person shape', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        person: { id: 3, name: 'Ada' },
        personal: { firstName: 'Ada' },
        sections: [
          {
            id: 10,
            type: 'experience',
            title: 'Experience',
            entries: [
              {
                id: 1,
                fields: { position: 'Engineer' },
                items: [{ id: 2, content: 'shipped it', tags: ['x'] }],
                tags: ['y'],
              },
            ],
          },
        ],
        variants: [{ id: 5, name: 'Quantum', kind: 'cv', rules: { include: ['q'] } }],
        coverletter: { opening: 'Dear' },
      }),
    );
    const res = await api().fetchPerson(3);
    expect(res.ok).toBe(true);
    expect(res.data?.name).toBe('Ada');
    expect(res.data?.sections[0].entries[0].fields.position).toBe('Engineer');
    expect(res.data?.sections[0].entries[0].items[0].content).toBe('shipped it');
    expect(res.data?.sections[0].entries[0].items[0].tags).toEqual(['x']);
    expect(res.data?.variants[0]).toMatchObject({ id: 5, name: 'Quantum', kind: 'cv' });
  });

  test('fetchPerson forwards a failed load as an error', async () => {
    fetchMock.mockResolvedValue(respond(403));
    const res = await api().fetchPerson(3);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('auth_required');
  });

  test('fetchActive lists profiles and loads the highest-id one', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(200, {
          persons: [
            { id: 1, name: 'A' },
            { id: 8, name: 'B' },
          ],
        }),
      )
      .mockResolvedValueOnce(respond(200, { person: { id: 8, name: 'B' } }));
    const res = await api().fetchActive();
    expect(res.ok).toBe(true);
    expect(res.data?.person.id).toBe(8);
    expect(res.data?.persons).toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/persons/8'); // loaded the newest
  });

  test('fetchActive with zero profiles → no_persons', async () => {
    fetchMock.mockResolvedValue(respond(200, { persons: [] }));
    const res = await api().fetchActive();
    expect(res.status).toBe(404);
    expect(res.error?.code).toBe('no_persons');
  });

  test('fetchActive propagates a failed profile list', async () => {
    fetchMock.mockResolvedValue(respond(403));
    const res = await api().fetchActive();
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('auth_required');
  });
});
