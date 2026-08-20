{/* ==================================================
    BILDER
================================================== */}

{Array.isArray(booking.image_urls) &&
  booking.image_urls.length > 0 && (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Bilder
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {booking.image_urls.map((url, index) => {
          const imageUrl =
            url.startsWith("http://") ||
            url.startsWith("https://")
              ? url
              : `https://cfiumzbuavfbahctzknr.supabase.co/storage/v1/object/public/Kunden-Bilder/${encodeURIComponent(
                  url,
                )}`

          return (
            <div
              key={`${url}-${index}`}
              className="overflow-hidden border border-border bg-background"
            >
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={`Buchungsbild ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(event) => {
                      console.error(
                        "Bild konnte nicht geladen werden:",
                        imageUrl,
                      )

                      event.currentTarget.style.display =
                        "none"
                    }}
                  />
                </div>
              </a>

              <div className="border-t border-border px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">
                  Bild {index + 1}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )}
