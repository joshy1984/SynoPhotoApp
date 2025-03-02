export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function filterPhotosByDay(photos: any[], day: number, month: number): any[] {
  return photos.filter(photo => {
    const photoDate = new Date(photo.time * 1000);
    return photoDate.getDate() === day && (photoDate.getMonth() + 1) === month;
  });
}

export function groupPhotosByPeriod(photos: any[], period: string): any[] {
  const photosByYear = new Map<number, any[]>();
  photos.forEach(photo => {
    const photoDate = new Date(photo.time * 1000);
    const year = photoDate.getFullYear();
    if (!photosByYear.has(year)) {
      photosByYear.set(year, []);
    }
    photosByYear.get(year)?.push(photo);
  });
  const groups: { title: string; photos: any[] }[] = [];
  const years = Array.from(photosByYear.keys()).sort((a, b) => b - a);
  years.forEach(year => {
    groups.push({
      title: year.toString(),
      photos: photosByYear.get(year) || []
    });
  });
  return groups;
}
