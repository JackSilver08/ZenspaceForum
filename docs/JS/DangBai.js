let currentUserId = null;
let currentRole = null;
let token = null;

document.addEventListener("DOMContentLoaded", function () {
  refreshUserInfo(); // 🛠 nạp token ngay lập tức sau khi DOM sẵn sàng
  loadBaiDang();
  const form = document.querySelector("#popupForm form");
  const popupOverlay = document.getElementById("popupOverlay");
  const closeBtn = document.getElementById("closePopupBtn");
  function refreshUserInfo() {
    token = localStorage.getItem("token");
    if (token) {
      const decoded = parseJwt(token);
      currentUserId = decoded?.id || null;
      currentRole = decoded?.phanQuyen || null;
    }
  }

  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch (e) {
      return null;
    }
  }
  console.log(parseJwt(localStorage.getItem("token")));
  async function loadBaiDang() {
    refreshUserInfo();
    try {
      const res = await fetch("/api/baiviet");
      const json = await res.json();

      console.log("📦 Dữ liệu từ API:", json);

      if (!json?.success) {
        console.error("❌ API báo lỗi:", json);
        return;
      }

      const danhSach = json.data;
      if (!Array.isArray(danhSach)) {
        console.error("❌ 'data' không phải là mảng:", danhSach);
        return;
      }

      const container = document.getElementById("danhSachBaiDang");
      container.innerHTML = "";
      for (const bai of danhSach) {
        const baiVietDiv = document.createElement("div");
        baiVietDiv.className = "bai-viet";
        baiVietDiv.style.marginBottom = "15px";
        baiVietDiv.style.borderBottom = "1px solid #eee";
        baiVietDiv.style.paddingBottom = "15px";

        let camXucHTML = "";
        try {
          const resCamXuc = await fetch(`/api/ThongKeCamXuc/${bai.id}`);
          const camXucData = await resCamXuc.json();
          const emojiMap = {
            like: "👍",
            love: "❤️",
            haha: "😂",
            wow: "😮",
            sad: "😢",
            angry: "😠",
          };
          for (const [k, v] of Object.entries(camXucData)) {
            camXucHTML += `<span style="margin-right:8px;">${
              emojiMap[k] || k
            } ${v}</span>`;
          }
        } catch (e) {
          camXucHTML = "<i>Không tải được cảm xúc</i>";
        }

        let html = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="noi-dung-bai" style="flex-grow: 1; cursor: pointer;">
            <h3 style="margin: 0 0 5px 0;">${bai.tieuDe}</h3>
            <p style="margin: 0 0 5px 0; color: #555;">
              ${bai.noiDung.substring(0, 100)}...
            </p>
            <small style="color: #888;">
              Đăng bởi: ${bai.tenDangNhap} - ${bai.ngayTao}
            </small>
            <div style="margin-top: 10px; font-size: 18px;">
              ${camXucHTML}
            </div>
          </div>`;

        if (
          currentRole === "admin" ||
          parseInt(bai.idTaiKhoan) === currentUserId
        ) {
          html += `
          <div>
            ${
              parseInt(bai.idTaiKhoan) === currentUserId
                ? `<button class="btn-sua" data-id="${bai.id}" 
                     style="margin-left: 10px; padding: 5px 10px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
                     Sửa
                   </button>`
                : ""
            }
            <button class="btn-xoa" data-id="${bai.id}" 
              style="margin-left: 10px; padding: 5px 10px; background-color: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Xóa
            </button>
          </div>`;
        }

        html += `
        </div>
        <div class="emoji-container">
          <div class="react-wrapper">
            <button class="react-toggle">😊</button>
            <div class="emoji-popover">
              <button class="emoji" data-type="like">👍</button>
              <button class="emoji" data-type="love">❤️</button>
              <button class="emoji" data-type="haha">😂</button>
              <button class="emoji" data-type="wow">😮</button>
              <button class="emoji" data-type="sad">😢</button>
              <button class="emoji" data-type="angry">😠</button>
            </div>
          </div>
        </div>`;

        baiVietDiv.innerHTML = html;

        // Sự kiện emoji
        baiVietDiv.querySelectorAll(".emoji").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const loaiCamXuc = btn.dataset.type;
            const idBaiDang = bai.id;
            try {
              const response = await fetch(`/api/ThemCamXuc/${idBaiDang}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + token,
                },
                body: JSON.stringify({ loaiCamXuc }),
              });
              if (response.ok) {
                loadBaiDang();
              } else {
                const errText = await response.text();
                alert("Lỗi: " + errText);
              }
            } catch (err) {
              alert("Không thể gửi cảm xúc");
            }
          });
        });

        // Sự kiện xem chi tiết
        baiVietDiv
          .querySelector(".noi-dung-bai")
          .addEventListener("click", (e) => {
            if (e.target.closest(".btn-sua, .btn-xoa, .btn-react")) return;
            window.location.href = `baiviet.html?id=${bai.id}`;
          });
        // Sự kiện sửa
        const btnSua = baiVietDiv.querySelector(".btn-sua");
        if (btnSua) {
          btnSua.addEventListener("click", async (e) => {
            e.stopPropagation();

            // Lấy bài viết cần sửa
            const idBaiDang = btnSua.dataset.id;

            try {
              const res = await fetch(`/api/baiviet/${idBaiDang}`);
              const bai = await res.json();
              if (!bai.success) {
                alert("Không thể tải bài viết để sửa.");
                return;
              }

              // Hiển thị form sửa với dữ liệu hiện có
              document.getElementById("title").value = bai.data.tieuDe;
              document.getElementById("content").value = bai.data.noiDung;
              popupOverlay.style.display = "block";
              form.dataset.editingId = idBaiDang;
              form.querySelector("button[type='submit']").textContent =
                "Cập nhật bài viết";
            } catch (err) {
              alert("Lỗi khi tải bài viết để sửa.");
            }
          });
        }
        // Sự kiện xoá
        const btnXoa = baiVietDiv.querySelector(".btn-xoa");
        if (btnXoa) {
          btnXoa.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;
            try {
              const res = await fetch(`/api/baiviet/${bai.id}`, {
                method: "DELETE",
                headers: {
                  Authorization: "Bearer " + token,
                },
              });
              const result = await res.json();
              if (result.success) {
                alert("✅ Đã xoá bài viết!");
                loadBaiDang();
              } else {
                alert("❌ Xoá thất bại: " + (result.message || "Lỗi không rõ"));
              }
            } catch (err) {
              alert("Không thể kết nối tới server để xoá bài viết.");
            }
          });
        }

        container.appendChild(baiVietDiv);
      }
    } catch (err) {
      console.error("Lỗi khi tải bài viết:", err);
      document.getElementById("danhSachBaiDang").textContent =
        "Không thể tải danh sách bài viết.";
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const TieuDe = document.getElementById("title").value.trim();
    const NoiDung = document.getElementById("content").value.trim();

    if (!TieuDe || !NoiDung) {
      alert("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
      return;
    }

    const editingId = form.dataset.editingId;

    try {
      if (editingId) {
        // 👉 Chế độ cập nhật
        const res = await fetch(`/api/baiviet/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ TieuDe, NoiDung }),
        });

        const result = await res.json();
        if (result.success) {
          alert("✅ Cập nhật bài viết thành công!");
          form.querySelector("button[type='submit']").textContent = "Đăng bài";
          delete form.dataset.editingId;
        } else {
          alert("❌ Cập nhật thất bại: " + (result.message || "Lỗi không rõ"));
          return;
        }
      } else {
        // 👉 Chế độ đăng mới
        const res = await fetch("/api/baiviet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ TieuDe, NoiDung }),
        });

        const result = await res.json();
        if (result.success) {
          alert("✅ Đăng bài thành công!");
        } else {
          alert("❌ Đăng thất bại: " + (result.message || "Lỗi không rõ"));
          return;
        }
      }

      form.reset();
      popupOverlay.style.display = "none";
      loadBaiDang();
    } catch (err) {
      alert("Không thể kết nối tới server");
      console.error(err);
    }
  });

  closeBtn.addEventListener("click", function () {
    popupOverlay.style.display = "none";
    form.reset();
    delete form.dataset.editingId;
    form.querySelector("button[type='submit']").textContent = "Đăng bài";
  });
});
