let currentUserId = null;
let currentRole = null;
let token = null;
// Thêm ở đầu file DangBai.js (phạm vi toàn cục)
let isSubmitting = false;
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
          const resCamXuc = await fetch(`/api/camxuc/thongke/${bai.id}`);
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
  <div style="
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    background-color: #ffffff; 
    padding: 16px; 
    border-radius: 12px; 
    margin-bottom: 20px; 
    box-shadow: 0 2px 6px rgba(0,0,0,0.1); 
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  " 
  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';" 
  onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.1)';"
  >

    <div class="noi-dung-bai" style="flex-grow: 1; cursor: pointer; color: #000; margin-right: 12px;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a4d8f;">
        ${bai.tieuDe}
      </h3>
      <p style="margin: 0 0 8px 0; color: #333;">
        ${bai.noiDung.substring(0, 100)}...
      </p>
      <small style="color: #666;">
        Đăng bởi: ${bai.tenDangNhap} - ${bai.ngayDang}
      </small>
      <div style="margin-top: 12px; font-size: 18px; color: #000;">
        ${camXucHTML}
      </div>
    </div>
  </div>
`;

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
              const response = await fetch(`/api/camxuc/${idBaiDang}`, {
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

  // Thêm biến này ở phạm vi toàn cục
  let submitEventRegistered = false;

  // Trong DOMContentLoaded
  if (form && !submitEventRegistered) {
    submitEventRegistered = true; // Đánh dấu đã đăng ký sự kiện

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      e.stopPropagation(); // Ngăn chặn sự kiện lan truyền

      const submitBtn = form.querySelector('button[type="submit"]');

      // Kiểm tra trạng thái submit chặt chẽ hơn
      if (isSubmitting || submitBtn.disabled) {
        console.log("Đang submit, bỏ qua");
        return;
      }

      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang xử lý...";

      const TieuDe = document.getElementById("title").value.trim();
      const NoiDung = document.getElementById("content").value.trim();

      if (!TieuDe || !NoiDung) {
        alert("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
        resetSubmitState();
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
          if (!res.ok) {
            throw new Error(result.message || "Cập nhật thất bại");
          }

          showSuccess("Cập nhật bài viết thành công!");
          form.querySelector("button[type='submit']").textContent = "Đăng bài";
          delete form.dataset.editingId;
        } else {
          // ===== Chế độ đăng mới =====
          const formData = new FormData();
          formData.append("tieuDe", TieuDe);
          formData.append("noiDung", NoiDung);

          const fileInput = document.getElementById("media");
          if (fileInput?.files?.length > 0) {
            formData.append("file", fileInput.files[0]);
          }

          const res = await fetch("/api/baiviet", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          const result = await res.json().catch(() => null);

          if (!res.ok || !result?.success) {
            throw new Error(result?.message || "Đăng bài thất bại");
          }

          showSuccess("Đăng bài thành công!");
        }

        // Reset form và ẩn popup
        resetForm();
      } catch (err) {
        console.error("Lỗi khi submit:", err);
        alert("❌ Lỗi: " + (err.message || "Không thể kết nối tới server"));
      } finally {
        resetSubmitState();
      }
    });
  }

  // Hàm helper
  function resetSubmitState() {
    isSubmitting = false;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = form.dataset.editingId ? "Cập nhật" : "Đăng bài";
    }
  }

  function resetForm() {
    form.reset();
    const mediaPreview = document.getElementById("mediaPreview");
    if (mediaPreview) mediaPreview.innerHTML = "";
    popupOverlay.style.display = "none";
    loadBaiDang(); // Chỉ gọi loadBaiDang() sau khi mọi thứ hoàn tất
  }

  function showSuccess(message) {
    alert("✅ " + message);
  }

  closeBtn.addEventListener("click", function () {
    popupOverlay.style.display = "none";
    form.reset();
    delete form.dataset.editingId;
    form.querySelector("button[type='submit']").textContent = "Đăng bài";
  });
});
