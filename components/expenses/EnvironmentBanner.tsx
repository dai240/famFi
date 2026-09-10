export function EnvironmentBanner({preview}:{preview:boolean}) {
  return preview ? <div className="environment-banner" role="status">検証用の家計簿</div> : null;
}
