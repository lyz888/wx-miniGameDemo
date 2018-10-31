
// const shareCanvas = wx.getSharedCanvas();
// console.log('开放域中canvas的大小', shareCanvas.width, shareCanvas.height)
// function getSize(n){
//   return n / 1136 * shareCanvas.width;
// }

const PAGE_SIZE = 5;
const ITEM_WIDTH = 880;
const ITEM_HEIGHT = 80;
const fontSize = 20;
const path = 'images/ranking/'
const defHead = path + 'head.png'
var server_time;


function isWeek(times, server_time){ //根据当前时间戳判断是否是本周内时间
  var updata_time = times * 1000;
  server_time = server_time * 1000;
  var now = new Date(server_time);
  var nowTime = now.getTime();
  var day = now.getDay();
  var oneDayTime = 24 * 60 * 60 * 1000;
  //显示周一
  var MondayTime = nowTime - (day - 1) * oneDayTime;
  var mon = new Date(MondayTime);
  mon.setHours(0, 0, 0);
  var monday = mon.getTime();

  //显示周日
  var SundayTime = nowTime + (7 - day) * oneDayTime;
  var sun = new Date(SundayTime);
  sun.setHours(23, 59, 59);
  var sunday = sun.getTime();
  if (updata_time > monday && updata_time < sunday) {
    return 1;
  }
  return 0;
}

class RankListRenderer {
  constructor() {
    this.offsetY = 0;
    this.maxOffsetY = 0;
    this.gameDatas = []; 
    this.avatarImgDict = {};
    this.init();
  }

  init() {
    this.canvas = wx.getSharedCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    //加载静态资源
    this.imgsList = [];
    for(let i = 1; i < 4; i++){
      let rankImg = wx.createImage();
      rankImg.src = `${path}no${i}.png`;
      this.imgsList.push(rankImg);
    }
    
  }

  dataSorter(gameDatas){
    var that = this;
    var OpenDataKeys = this.OpenDataKeys;
    // return gameDatas.sort((a, b) => {
    //   const kvDataA = a.KVDataList.find(kvData => kvData.key === OpenDataKeys[0]);
    //   const kvDataB = b.KVDataList.find(kvData => kvData.key === OpenDataKeys[0]);
    //   const gradeA = kvDataA ? parseInt(kvDataA.value || 0) : 0;
    //   const gradeB = kvDataB ? parseInt(kvDataB.value || 0) : 0;
    //   return gradeA > gradeB ? -1 : gradeA < gradeB ? 1 : 0;
    // });

    var arr = gameDatas;
    arr = arr.filter(function (item) {
      const winNum = item.KVDataList.find(kvData => kvData.key === OpenDataKeys[0]);
      const updataTime = item.KVDataList.find(kvData => kvData.key === OpenDataKeys[1]);
      return (
        item.KVDataList.length >= 2 
        &&
        isWeek(updataTime.value, server_time) &&
        winNum.value > 0
        );
    })
    //console.log('过滤后的数组', arr)
    arr.sort(function (a, b) {
      const kvDataA = a.KVDataList.find(kvData => kvData.key === OpenDataKeys[0]);
      const kvDataB = b.KVDataList.find(kvData => kvData.key === OpenDataKeys[0]);
      return kvDataB.value - kvDataA.value
      //return b.KVDataList[0].value - a.KVDataList[0].value;

    })
    arr.push({
      stop: 1
    })
    return arr;
  }

  listen() {
    var that = this;
    //msg -> {action, data}
    wx.onMessage(msg => {
      //console.log("ranklist wx.onMessage", msg);
      this.msgData = msg;
      that.OpenDataKeys = ['win_week', 'update_time'];
      if (msg.model === "endless"){ //无尽模式
        that.OpenDataKeys = ['unlimit_score', 'update_time', 'unlimit_streaks'];
      }
      let tp = msg.type; 
      that.msgType = msg.type;
      if (msg.server_time){
        server_time = msg.server_time;
      }
      
      switch (tp) {
        case 'friend':
          this.fetchFriendData();
          break;
        case 'landscape_friend':
          //this.fetchFriendData();
          this.drawLandscapeRL();
          break;
        case 'endlessFriend':
          this.fetchFriendData();
          break;
        case 'world':
          let info = msg.info;
          //console.log('子域世界数据', info)
          this.fetchWorldData(info);
          break;
        case 'group':
          if (!msg.shareTicket) {
            return;
          }
          this.fetchGroupData(msg.shareTicket);
          break;

        case 'touchMove':
          if (!this.gameDatas.length) {
            return;
          }
          const deltaY = msg.data;
          // if (Math.abs(deltaY) < 20){
              
          //     return;
          // }
          const newOffsetY = this.offsetY + deltaY;
          if (newOffsetY < 0) {
            console.log("前面没有更多了");
            return;
          }
          if (newOffsetY + PAGE_SIZE * ITEM_HEIGHT > this.maxOffsetY) {
            console.log("后面没有更多了");
            return;
          }
          this.offsetY = newOffsetY;
          this.showRanks(newOffsetY);
          break;

        default:
          console.log(`未知消息类型:msg.action=${tp}`);
          break;
      }
    });
  }

  fetchGroupData(shareTicket) {
    var that = this;
    //取出群同玩成员数据
    wx.getGroupCloudStorage({
      shareTicket,
      keyList: that.OpenDataKeys,
      success: res => {
        console.log("wx.getGroupCloudStorage success", res);
        if (res.data.length == 0){
          return;
        }
        this.gameDatas = this.dataSorter(res.data);
        const dataLen = this.gameDatas.length;
        this.offsetY = 0;
        this.maxOffsetY = (dataLen) * ITEM_HEIGHT;
        if (dataLen) {
          this.showRanks(0);
        }
      },
      fail: res => {
        console.log("wx.getGroupCloudStorage fail", res);
      },
    });
  }

  fetchWorldData(arr){
    var that = this;
    arr.push({
      stop: 1
    })
    wx.getFriendCloudStorage({
      keyList: this.OpenDataKeys,
      success: res => {
        console.log("wx.getFriendCloudStorage success", res);
        const dataLen = arr.length;
        this.gameDatas = arr;
        this.offsetY = 0;
        this.maxOffsetY = dataLen * ITEM_HEIGHT;
        if (dataLen) {
          this.showRanks(0);
        }
      },
      fail: res => {
        console.log("wx.getFriendCloudStorage fail", res);
      },
    });
    
  }

  fetchFriendData() {
    var that = this;
    //取出所有好友数据
    wx.getFriendCloudStorage({
      keyList: that.OpenDataKeys,
      success: res => {
        console.log("wx.getFriendCloudStorage success", res);
        if (res.data.length == 0) {
          return;
        }
        this.gameDatas = this.dataSorter(res.data);
        const dataLen = this.gameDatas.length;
        this.offsetY = 0;
        this.maxOffsetY = dataLen * ITEM_HEIGHT;
        if (dataLen) {
          this.showRanks(0);
        }
      },
      fail: res => {
        console.log("wx.getFriendCloudStorage fail", res);
      },
    });
  }

  drawLandscapeRL(){ //获取本机用户信息
    var that = this;
    
    //取出所有好友数据
    wx.getFriendCloudStorage({
      keyList: this.OpenDataKeys,
      success: res => {
        console.log("wx.getFriendCloudStorage success", res);
        if (res.data.length == 0) {
          return;
        }
        var userArray = this.dataSorter(res.data);
        userArray.pop();
        // const dataLen = this.gameDatas.length;
        // this.offsetY = 0;
        // this.maxOffsetY = dataLen * ITEM_HEIGHT;
        // if (dataLen) {
        //   this.showRanks(0);
        // }
        
        wx.getUserInfo({
          openIdList: ['selfOpenId'],
          lang: 'zh_CN',
          success: (res) => {
           // console.log('success', res.data)
            const user = res.data[0];
            var newArray = [];
            userArray.map((item, index) => {
              if (
                item.nickname == user.nickName
                &&
                item.avatarUrl == user.avatarUrl
              ) {
                if (userArray[index - 2]){
                  userArray[index - 2].idx = index - 2 + 1;
                }
                if (userArray[index - 1]) {
                  userArray[index - 1].idx = index - 1 + 1;
                }
                if (userArray[index]) {
                  userArray[index].idx = index + 1;
                }
                if (userArray[index + 1]) {
                  userArray[index + 1].idx = index + 1 + 1;
                }
                if (userArray[index + 2]) {
                  userArray[index + 2].idx = index + 2 + 1;
                }
                if (userArray[index - 1] && userArray[index + 1]) {
                  newArray.push(userArray[index - 1])
                  newArray.push(userArray[index + 0])
                  newArray.push(userArray[index + 1])
                  return;
                }

                if (userArray[index - 1]) {
                  if (userArray[index - 2]) {
                    newArray.push(userArray[index - 2])
                    newArray.push(userArray[index - 1])
                    newArray.push(userArray[index + 0])
                    return;
                  }
                  newArray.push(userArray[index - 1])
                  newArray.push(userArray[index + 0])
                  return;
                  
                } 

                if (userArray[index + 1]) {
                  if (userArray[index + 2]) {
                    newArray.push(userArray[index + 0])
                    newArray.push(userArray[index + 1])
                    newArray.push(userArray[index + 2])
                    return;
                  }
                  newArray.push(userArray[index + 0])
                  newArray.push(userArray[index + 1])
                  return;
                }

                newArray.push(userArray[index])
                return;

              }
            })
            console.log('3人排行榜数据', newArray)
            for (let i = 0, len = newArray.length; i < len; i++) {
              drawItem_landscape(this.ctx, i, 1, newArray[i], 0, 0);
            }
          },
          fail: (res) => {
            console.error(res)
          }
        })
        
      },
      fail: res => {
        console.log("wx.getFriendCloudStorage fail", res);
      },
    });

    function drawItem_landscape(ctx, index, rank, data, startY, prevOffsetY) {

      const nowX = index * 230;
      const nick = data.nickname.length <= 5 ? data.nickname : data.nickname.substr(0, 5) + "...";
      const kvData = data.KVDataList.find(kvData => kvData.key === that.OpenDataKeys[0]);
      var score = kvData.value;
      // const cues = data.KVDataList.find(kvData => kvData.key === that.OpenDataKeys[2]);
      // let score = kvData.value + '胜';
      // if (cues) {
      //   score = kvData.value + '分/' + cues.value + '连杆'
      // }

      //排名
      ctx.fillStyle = "#fad254";
      ctx.textAlign = "right";
      ctx.baseLine = "middle";
      ctx.font = "28px Helvetica";
      ctx.fillText(String(data.idx), 60 + nowX, 50);
      //头像
      const avatarX = 70 + nowX;
      const avatarY = 10;
      const avatarW = 60;
      const avatarH = 60;
      that.drawAvatar(ctx, data, avatarX, avatarY, avatarW, avatarH, (avatarImg) => {
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarW, avatarH);
        // if (prevOffsetY == this.offsetY) {
        //   ctx.drawImage(avatarImg, avatarX, avatarY, avatarW, avatarH);
        // }
      })

      //名字
      ctx.fillStyle = "#999";
      ctx.textAlign = "left";
      ctx.baseLine = "middle";
      ctx.font = "18px Helvetica";
      ctx.fillText(nick, 140 + nowX, 30);

      //分数
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.baseLine = "middle";
      ctx.font = "26px Helvetica";
      ctx.fillText(score, 140 + nowX, 70);
    }
    
  }

  showRanks(offsetY) {
    const startY = offsetY % ITEM_HEIGHT;
    const startIndex = Math.floor(offsetY / ITEM_HEIGHT);
    const stopIndex = startIndex + PAGE_SIZE + (startY == 0 ? 0 : 1);
    const datas = this.gameDatas.slice(startIndex, stopIndex);

    this.ctx.clearRect(0, 0, 1000, 1000);
    //console.log(datas)
    for (let i = 0, len = datas.length; i < len; i++) {
      this.drawRankItem(this.ctx, i, startIndex + i + 1, datas[i], startY, this.offsetY);
    }
  }

  drawAvatar(ctx, data, x, y, w, h, cb) {
    var that = this;
    let avatarUrl = data.avatarUrl;
    // console.log(avatarUrl)
    // if (!avatarUrl){
    //   avatarUrl = avatarUrl.substr(0, avatarUrl.lastIndexOf('/')) + "/132";
    //   avatarUrl = defHead;
    // }
    
    // ctx.fillStyle = "#ffffff";
    // ctx.fillRect(x - 5, y - 5, w + 10, h + 10);

    // const avatarImg = wx.createImage();
    // avatarImg.src = avatarUrl ? avatarUrl : defHead;
    // avatarImg.onload = () => {
    //   cb(avatarImg);
    // };
    
    let avatarImg = this.avatarImgDict[data.nickname];
    if (avatarImg) {
      cb(avatarImg);
    }else{
      avatarImg = wx.createImage();
      avatarImg.src = avatarUrl ? avatarUrl : defHead;
      avatarImg.onload = () => {
        that.avatarImgDict[data.nickname] = avatarImg;
        cb(avatarImg);
      };
    }

  }

  //canvas原点在左上角
  drawRankItem(ctx, index, rank, data, startY, prevOffsetY) {
    var that = this;
    const itemGapY = ITEM_HEIGHT * index - startY;
    if (data.stop){
      ctx.fillStyle = "#a6a9eb";
      ctx.textAlign = "center";
      ctx.baseLine = "middle";
      ctx.font = "20px Helvetica";
      ctx.fillText('没有更多数据了', this.canvas.width / 2, 50 + itemGapY);
        return;
    }
    const nick = data.nickname.length <= 10 ? data.nickname : data.nickname.substr(0, 10) + "...";
    const kvData = data.KVDataList.find(kvData => kvData.key === that.OpenDataKeys[0]);
    const cues = data.KVDataList.find(kvData => kvData.key === that.OpenDataKeys[2]);
    let score = kvData.value + '胜';
    if (cues){
      score = kvData.value + '分/' + cues.value + '连杆'
    }
    //const grade = kvData ? kvData.value : 0;
    

    //背景颜色
    if (this.msgType == 'endlessFriend' || this.msgData.friendType == 'endless') {
      // ctx.fillStyle = "#fff";
      // ctx.fillRect(150, ITEM_HEIGHT * (index + 1), 500, 1);
    }else{
      if (rank % 2 == 1) {

        ctx.fillStyle = "#4a405f";
        ctx.fillRect(0, itemGapY, ITEM_WIDTH, ITEM_HEIGHT);

        // const rankImg = wx.createImage();
        // rankImg.src = `assets/ranking/whiteRect.png`;
        // rankImg.onload = () => {
        //   if (prevOffsetY == this.offsetY) {
        //     ctx.drawImage(rankImg, 0, itemGapY, ITEM_WIDTH, ITEM_HEIGHT);
        //   }

        // };
      }
    } 

    

    //名次
    if (rank < 4) {
      let rankImg = this.imgsList[rank - 1];
      if (prevOffsetY == this.offsetY) {
        ctx.drawImage(rankImg, 25, 20 + itemGapY, 48, 38);
      }
      // const rankImg = wx.createImage();
      // rankImg.src = `${path}no${rank}.png`;
      // rankImg.onload = () => {
      //   if (prevOffsetY == this.offsetY) {
      //     ctx.drawImage(rankImg, 25, 20 + itemGapY, 48, 38);
      //   }
      // };
    } else {
      ctx.fillStyle = "#BDBDBD";
      ctx.textAlign = "center";
      ctx.baseLine = "middle";
      ctx.font = "20px Helvetica";
      ctx.fillText(`${rank}`, 50, 50 + itemGapY);
    }

    //头像
    const avatarX = 95;
    const avatarY = 10 + itemGapY;
    const avatarW = 60;
    const avatarH = 60;
    this.drawAvatar(ctx, data , avatarX, avatarY, avatarW, avatarH, (avatarImg) => {
      if (prevOffsetY == this.offsetY) {
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarW, avatarH);
      }
    })

    //名字
    ctx.fillStyle = "#a6a9eb";
    ctx.textAlign = "left";
    ctx.baseLine = "middle";
    ctx.font = "20px Helvetica";
    ctx.fillText(nick, 180, 50 + itemGapY);

    //分数
    ctx.fillStyle = "#cfa972";
    ctx.textAlign = "right";
    ctx.baseLine = "middle";
    ctx.font = "20px Helvetica";
    let dx = 850;
    if (this.msgType == 'endlessFriend' || this.msgData.friendType == 'endless'){
        dx = 660;
    }
    ctx.fillText(score, dx, 50 + itemGapY);
  }
}

const rankList = new RankListRenderer();
rankList.listen();
