import { Component, OnInit, AfterViewInit, ViewChild } from "@angular/core";
import { Hmacsha1Service, ElectronService } from "../core/services";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { ModalDirective } from "angular-bootstrap-md";
import { ToastrService } from "ngx-toastr";
import { WriteStream } from "fs";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild("pagesModal", { static: true }) pagesModal: ModalDirective;

  cookies: string = "";
  libroId: number = 0;

  savePath: string = "";

  libraryForm = new FormGroup({
    jSessionId: new FormControl("", Validators.required),
    ezProxy: new FormControl("", Validators.required),
    bookId: new FormControl("", Validators.required),
    pageFrom: new FormControl("", Validators.required),
    pageTo: new FormControl(""),
    isMultipleDownload: new FormControl(false)
  });

  pages: Array<object> = [];
  pagesText: string = "";

  constructor(
    private hMacSha1Service: Hmacsha1Service,
    private electronService: ElectronService,
    private toastr: ToastrService
  ) {}

  // http://bv.unir.net:2116/ib/NPcd/IB_Escritorio_Visualizar?cod_primaria=1000193&libro=4143
  // http://bv.unir.net:2116/ib/IB_Browser?pagina=1&libro=4143&ultpag=1&id=f38dc7a54df8773c3118b2710ff375f85b210fce
  ngOnInit() {}

  ngAfterViewInit() {}

  onSubmit() {
    this.pages = [];
    this.pagesText = "";

    if (this.libraryForm.valid) {
      this.cookies =
        "JSESSIONID=" +
        this.libraryForm.controls.jSessionId.value +
        "; " +
        "ezproxy=" +
        this.libraryForm.controls.ezProxy.value;

      this.libroId = this.libraryForm.controls.bookId.value;

      if (!this.libraryForm.controls.isMultipleDownload.value) {
        let page: number = parseInt(this.libraryForm.controls.pageFrom.value);
        if (page > 0) {
          this.getPage(page);
          this.pagesText = "pages=['" + this.pages[0] + "']";
        }
      } else {
        let pageFrom = parseInt(this.libraryForm.controls.pageFrom.value);
        let pageTo = parseInt(this.libraryForm.controls.pageTo.value);
        if (pageFrom < pageTo && pageFrom > 0) {
          for (let pageIndex = pageFrom; pageIndex <= pageTo; pageIndex++) {
            this.getPage(pageIndex);
          }
          this.pagesText = "pages=[";
          for (let index = 0; index < this.pages.length - 1; index++) {
            const element = this.pages[index];
            this.pagesText += "'" + element + "', ";
          }
          this.pagesText += "'" + this.pages[this.pages.length - 1] + "'" + "]";
        }
      }
      this.pagesModal.show();
    } else {
    }
  }

  getPage(pageNumber) {
    let id: string = "";
    id = this.generateHash(pageNumber);

    // http://bv.unir.net:2116/ib/IB_Browser?pagina=1&libro=4143&ultpag=1&id=f38dc7a54df8773c3118b2710ff375f85b210fce
    let url =
      "http://bv.unir.net:2116/ib/IB_Browser?pagina=" +
      pageNumber +
      "&libro=" +
      this.libroId +
      "&id=" +
      id;

    this.pages.push({ url: url, pageNumber: pageNumber });
  }

  generateHash(page) {
    return this.hMacSha1Service.hex_sha1(
      this.libraryForm.controls.jSessionId.value +
        "." +
        this.libroId +
        "." +
        page
    );
  }

  closeModal() {
    this.pagesModal.hide();
  }

  getPdfRequest(page) {
    const myURL = new URL(page.url);
    const path = this.electronService.url.parse(page.url).path;
    const pageNumber = myURL.searchParams.get("pagina");
    const libro = myURL.searchParams.get("libro");

    let ws: WriteStream = this.electronService.fs.createWriteStream(
      this.savePath + "/" + libro + "/" + pageNumber
    );

    ws.on("open", () => {
      // http://bv.unir.net:2116/ib/IB_Browser?pagina=1&libro=4143&ultpag=1&id=a201e3881ada281aed23c848a8dc52c54b7d4719
      let options = {
        host: myURL.hostname,
        port: myURL.port,
        path: path,
        method: "GET",
        headers: {
          Cookie: this.cookies
        }
      };
      let results = "";
      let req = this.electronService.http.request(options, res => {
        // res.setEncoding("binary");
        res.on("data", chunk => {
          // results = results + chunk;
          //TODO
          ws.write(chunk);
        });
        res.on("end", () => {
          ws.end();
        });
      });

      req.on("error", e => {});

      req.end();
    });
  }

  download(page) {
    try {
      this.savePath = "";
      this.savePath = this.electronService.remote.dialog.showOpenDialogSync({
        properties: ["openDirectory"]
      })[0];

      if (this.savePath !== "") {
        if (
          !this.electronService.fs.existsSync(
            this.savePath + "/" + this.libroId
          )
        ) {
          this.electronService.fs.mkdirSync(this.savePath + "/" + this.libroId);
        }
      }
      // }
    } catch (err) {
      // console.error(err);
    }
  }
}

// function download(url, tempFilepath, filepath, callback) {
//   var tempFile = fs.createWriteStream(tempFilepath);
//   tempFile.on('open', function (fd) {
//     http.request(url, function (res) {
//       res.on('data', function (chunk) {
//         tempFile.write(chunk);
//       }).on('end', function () {
//         tempFile.end();
//         fs.renameSync(tempFile.path, filepath);
//         return callback(filepath);
//       });
//     });
//   });
// }
