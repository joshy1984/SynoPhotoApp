import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { FC } from 'hono/jsx'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import dotenv from 'dotenv'
import nodeCron from 'node-cron'

import { SynologyService } from './services/synology.js'
import { EmailService } from './services/email.js'
import { filterPhotosByDay, getWeekNumber, groupPhotosByPeriod } from './utils/date.js'

dotenv.config()

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('/public/*', serveStatic({ root: './' }))

// Initialize services
const synoService = new SynologyService(
  process.env.NAS_IP!,
  process.env.USER_ID!,
  process.env.USER_PASSWORD!,
  process.env.FOTO_TEAM === 'true'
)

const emailService = new EmailService(
  process.env.SERVICE_NAME!,
  process.env.SEND_EMAIL!,
  process.env.SEND_EMAIL_PASSWORD!,
  process.env.RECEIVE_EMAIL!,
  process.env.EMAIL_SUBJECT!
)

// Layout component: a címsor "Emlékek a mai napról..." marad
const Layout: FC = ({ children }) => (
  <html>
    <head>
      <meta charSet="UTF-8" />
      <title>Emlékek a mai napról...</title>
      <link rel="stylesheet" href="/public/styles.css" />
      <meta name="color-scheme" content="dark light" />
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Emlékek a mai napról...</h1>
        </div>
        <div className="date-picker">
          <label htmlFor="photo-date">Válassz dátumot:</label>
          <input type="date" id="photo-date" name="photo-date" defaultValue={new Date().toISOString().split("T")[0]} />
          <button id="fetch-photos-btn">Frissítés</button>
        </div>
        <div id="photos-container" style={{ marginTop: "20px" }}></div>
      </div>
      <div id="lightbox" className="lightbox" style={{ display: "none", position: "fixed", top: "0", left: "0", width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
        <div style={{ position: "relative" }}>
          <button id="lightbox-close" style={{ position: "absolute", top: "10px", right: "10px", background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}>×</button>
          <img id="lightbox-img" src="" alt="" style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
          <button id="lightbox-prev" style={{ position: "absolute", top: "50%", left: "-40px", background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}>‹</button>
          <button id="lightbox-next" style={{ position: "absolute", top: "50%", right: "-40px", background: "transparent", color: "white", fontSize: "2rem", border: "none", cursor: "pointer" }}>›</button>
        </div>
      </div>
      <script src="/public/main.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("DOMContentLoaded", function() {
              var dateInput = document.getElementById("photo-date");
              var today = new Date().toISOString().split("T")[0];
              dateInput.value = today;
              
              // Automatikus fotólekérés oldalbetöltéskor
              fetchPhotos();
              
              var fetchBtn = document.getElementById("fetch-photos-btn");
              fetchBtn.addEventListener("click", fetchPhotos);
              
              var allImages = [];
              var currentImageIndex = -1;
              var lightbox = document.getElementById("lightbox");
              var lightboxImg = document.getElementById("lightbox-img");
              var lightboxClose = document.getElementById("lightbox-close");
              var lightboxPrev = document.getElementById("lightbox-prev");
              var lightboxNext = document.getElementById("lightbox-next");
              
              lightboxClose.addEventListener("click", function() {
                lightbox.style.display = "none";
              });
              
              lightbox.addEventListener("click", function(e) {
                if (e.target === lightbox) {
                  lightbox.style.display = "none";
                }
              });
              
              lightboxPrev.addEventListener("click", function(e) {
                e.stopPropagation();
                if (currentImageIndex > 0) {
                  currentImageIndex--;
                  showImage(currentImageIndex);
                }
              });
              
              lightboxNext.addEventListener("click", function(e) {
                e.stopPropagation();
                if (currentImageIndex < allImages.length - 1) {
                  currentImageIndex++;
                  showImage(currentImageIndex);
                }
              });
              
              function openLightbox(index) {
                currentImageIndex = index;
                showImage(index);
                lightbox.style.display = "flex";
              }
              
              function showImage(index) {
                var imgData = allImages[index];
                if (imgData) {
                  lightboxImg.src = imgData.fullUrl || imgData.thumbnailUrl;
                  lightboxImg.alt = imgData.name || "Fotó";
                }
              }
              
              async function fetchPhotos() {
                var selectedDate = dateInput.value;
                try {
                  var resp = await fetch("/api/photos?date=" + encodeURIComponent(selectedDate));
                  if (!resp.ok) {
                    throw new Error("Hiba a fotók lekérésekor: " + resp.status);
                  }
                  var data = await resp.json();
                  var photosContainer = document.getElementById("photos-container");
                  photosContainer.innerHTML = "";
                  allImages = [];
                  if (!data.groups || data.groups.length === 0) {
                    photosContainer.innerHTML = "<p>Nincsenek fotók erre a napra.</p>";
                    return;
                  }
                  data.groups.forEach(function(group) {
                    var groupDiv = document.createElement("div");
                    groupDiv.className = "group-container";
                    var title = document.createElement("h2");
                    title.textContent = group.title;
                    groupDiv.appendChild(title);
                    var hr = document.createElement("hr");
                    groupDiv.appendChild(hr);
                    var grid = document.createElement("div");
                    grid.className = "photos-grid";
                    group.photos.forEach(function(photo) {
                      var img = document.createElement("img");
                      img.src = photo.thumbnailUrl || photo.fullUrl;
                      img.alt = photo.name || "Fotó";
                      img.style.cursor = "pointer";
                      img.addEventListener("click", function() {
                        var globalIndex = allImages.findIndex(function(item) { return item.id === photo.id; });
                        if (globalIndex !== -1) {
                          openLightbox(globalIndex);
                        }
                      });
                      grid.appendChild(img);
                      if (!allImages.find(function(item) { return item.id === photo.id; })) {
                        allImages.push(photo);
                      }
                    });
                    groupDiv.appendChild(grid);
                    photosContainer.appendChild(groupDiv);
                  });
                } catch (err) {
                  alert("Hiba történt a fotók lekérésekor: " + err);
                }
              }
            });
          `
        }}
      ></script>
    </body>
  </html>
);

app.get('/', c => c.html(<Layout />));

app.get('/api/photos', async c => {
  try {
    var selectedDate = c.req.query("date") || new Date().toISOString().split("T")[0];
    var sid = await synoService.authenticate();
    var allPhotos = await synoService.fetchPhotos(sid);
    var dateObj = new Date(selectedDate);
    var month = dateObj.getMonth() + 1;
    var day = dateObj.getDate();
    var filteredPhotos = allPhotos.filter(function(photo) {
      if (!photo.time) return false;
      var photoDate = new Date(photo.time * 1000);
      return (photoDate.getMonth() + 1 === month) && (photoDate.getDate() === day);
    });
    var groups = groupPhotosByPeriod(filteredPhotos, "day");
    return c.json({ groups: groups });
  } catch (error) {
    console.error("Error in /api/photos:", error);
    return c.json({ error: "Failed to fetch photos" }, 500);
  }
});

async function sendPhotoEmail(selectedDate?: string) {
  try {
    console.log("Starting photo email process...");
    var sid = await synoService.authenticate();
    console.log("Successfully authenticated with Synology");
    var photos = await synoService.fetchPhotos(sid);
    console.log("Fetched " + photos.length + " photos total");
    var dateObj = selectedDate ? new Date(selectedDate) : new Date();
    var month = dateObj.getMonth() + 1;
    var day = dateObj.getDate();
    var filteredPhotos = photos.filter(function(photo) {
      if (!photo.time) return false;
      var photoDate = new Date(photo.time * 1000);
      return (photoDate.getMonth() + 1 === month) && (photoDate.getDate() === day);
    });
    console.log("Filtered to " + filteredPhotos.length + " photos for month " + month + " and day " + day);
    if (filteredPhotos.length === 0) {
      console.log("No photos to send for this period");
      return;
    }
    // Non-null assertion: biztosítjuk, hogy env változók nem undefined
    await emailService.sendPhotoEmail(filteredPhotos, process.env.NAS_IP!, process.env.PORT!);
    console.log("Email sent successfully");
  } catch (error: any) {
    console.error("Error in sendPhotoEmail:", error);
    throw error;
  }
}

async function sendPhotoEmailWithRetry(selectedDate?: string, retries = 5) {
  try {
    await sendPhotoEmail(selectedDate);
    console.log("Email successfully sent.");
  } catch (error: any) {
    var msg = (error.message || "").toLowerCase();
    if (msg.includes("ehostunreach") && retries > 0) {
      console.error("Email sending failed: " + error.message + ". Retrying in 15 minutes...");
      setTimeout(function() {
        sendPhotoEmailWithRetry(selectedDate, retries - 1);
      }, 15 * 60 * 1000);
    } else {
      console.error("Email sending failed permanently:", error);
    }
  }
}

const scheduleType = process.env.SEND_BY?.trim();
const emailSchedule = process.env.EMAIL_SCHEDULE || "09:00";
const [cronHour, cronMinute] = emailSchedule.split(":").map(function(num) { return parseInt(num, 10); });
if (!isNaN(cronHour) && !isNaN(cronMinute)) {
  if (scheduleType === "day") {
    const cronExpressionDay = cronMinute + " " + cronHour + " * * *";
    console.log("Scheduling daily email at " + emailSchedule);
    nodeCron.schedule(cronExpressionDay, function() { sendPhotoEmailWithRetry(); });
  } else if (scheduleType === "week") {
    const cronExpressionWeek = cronMinute + " " + cronHour + " * * 1";
    console.log("Scheduling weekly email at " + emailSchedule + " every Monday");
    nodeCron.schedule(cronExpressionWeek, function() { sendPhotoEmailWithRetry(); });
  } else if (scheduleType === "month") {
    const cronExpressionMonth = cronMinute + " " + cronHour + " 1 * *";
    console.log("Scheduling monthly email at " + emailSchedule + " on the 1st of each month");
    nodeCron.schedule(cronExpressionMonth, function() { sendPhotoEmailWithRetry(); });
  } else {
    console.log("No valid SEND_BY, skipping cron scheduling.");
  }
} else {
  console.log("Invalid EMAIL_SCHEDULE format: " + emailSchedule + ". Expected HH:MM.");
}

app.get('/api/test-email', async c => {
  try {
    console.log("Manual email trigger requested");
    var selectedDate = c.req.query("date") || undefined;
    await sendPhotoEmailWithRetry(selectedDate);
    return c.json({ success: true, message: "Email sending process initiated" });
  } catch (error) {
    console.error("Error in test email endpoint:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

const port = parseInt(process.env.PORT || "8080", 10);
console.log("Server is running on port " + port);
serve({ fetch: app.fetch, port });
