import { Agent } from 'node:https';

const httpsAgent = new Agent({
  rejectUnauthorized: false
});
// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface MyRequestInit extends RequestInit {
  agent?: Agent;
}

const fetchOptions: MyRequestInit = {
  mode: 'cors',
  credentials: 'include',
  agent: httpsAgent
};

export class SynologyService {
  ip: string;
  userId: string;
  password: string;
  fotoSpace: string;

  constructor(ip: string, userId: string, password: string, isFotoTeam: boolean) {
    if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
      ip = 'https://' + ip;
    }
    ip = ip.replace(/\/$/, '');
    this.ip = ip;
    this.userId = userId;
    this.password = password;
    this.fotoSpace = isFotoTeam ? 'FotoTeam' : 'Foto';
  }

  async authenticate(): Promise<string> {
    const authUrl = `${this.ip}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${this.userId}&passwd=${this.password}&session=FileStation&format=sid`;
    console.log('Authenticating with URL:', authUrl);
    const response = await globalThis.fetch(authUrl, fetchOptions);
    const rawAuthResponse = await response.text();
    console.log('Raw auth response:', rawAuthResponse);
    const data = JSON.parse(rawAuthResponse);
    if (!data.success) {
      console.error('Authentication failed:', data);
      throw new Error('Authentication failed: ' + JSON.stringify(data));
    }
    const sid = data.data.sid;
    console.log('Successfully authenticated, got session ID');
    return sid;
  }

  async fetchPhotos(sid: string): Promise<any[]> {
    const infoUrl = `${this.ip}/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all`;
    console.log('Getting API info:', infoUrl);
    const infoResponse = await globalThis.fetch(infoUrl, fetchOptions);
    await infoResponse.json();
    const batchSize = 500;
    let offset = 0;
    let allPhotos: any[] = [];
    let hasMore = true;
    while (hasMore) {
      const url = `${this.ip}/webapi/entry.cgi?api=SYNO.${this.fotoSpace}.Browse.Item&version=1&method=list&additional=["thumbnail","resolution","orientation","video_convert","video_meta"]&type=photo&sort_by=takentime&sort_direction=desc&offset=${offset}&limit=${batchSize}&_sid=${sid}`;
      console.log(`Fetching photos batch from offset ${offset}`);
      const response = await globalThis.fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawResponse = await response.text();
      const data = JSON.parse(rawResponse);
      if (!data.success) {
        console.error('Synology API returned error:', data);
        throw new Error(`Failed to fetch photos: ${JSON.stringify(data)}`);
      }
      const processedPhotos = data.data.list.map((photo: any) => {
        const thumbnailUrl = photo.additional.thumbnail
          ? this.getThumbnailUrl(photo.id, photo.additional.thumbnail.cache_key, sid)
          : undefined;
        return {
          ...photo,
          thumbnailUrl
        };
      });
      allPhotos = allPhotos.concat(processedPhotos);
      hasMore = processedPhotos.length === batchSize;
      offset += batchSize;
    }
    console.log(`Successfully fetched ${allPhotos.length} total photos`);
    return allPhotos;
  }

  getThumbnailUrl(id: string, cacheKey: string, sid: string): string {
    return `${this.ip}/webapi/entry.cgi?api=SYNO.${this.fotoSpace}.Thumbnail&version=1&method=get&mode=download&id=${id}&type=unit&size=xl&cache_key=${cacheKey}&_sid=${sid}`;
  }
}
