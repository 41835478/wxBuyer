import Http from '../utils/Http';
const wxApi = require('../utils/wxApi');
const app = getApp();

/**
 * 权限服务类
 */
export default class AuthService {

    constructor() {
        this.publicUrl = app.globalData.publicUrl;
        this.baseUrl = this.publicUrl + '';
    }


    /**
     * 获取JS_CODE
     */
    getWxJsCode() {
        return wxApi.wxLogin().then(res => {
            if (res.code == null && res.code == '') {
                return Promise.reject('用户登录js_code获取失败');
            }
            else {
                return res.code;
            }
        });
    }


    /**
     * 获取登录码
     */
    getLoginCode(jsCode) {
        const url = `${this.baseUrl}/auth/session`;
        const param = {
            code: jsCode,
            shop_code: app.globalData.shop.code
        };

        return Http.get(url, param).then(data => {
            console.info(`获取权限信息成功: third_session=${data.third_session}`);
            return data;
        });
    }


    /**
     * 获取用户信息
     */
    getWxUserInfo() {
        console.info('获取用户信息');
        return wxApi.wxGetUserInfo();
    }


    /**
     * 检查用户信息
     */
    checkUserInfo(rawUser) {
        console.info('校验用户信息完整性');
        const url = `${this.baseUrl}/auth/checkUserInfo`;
        const third_session = app.globalData.auth.third_session;
        const param = {
            rawData: rawUser.rawData,
            signature: rawUser.signature,
            sessionId: third_session,
            shop_code: app.globalData.shop.code
        };
        return Http.get(url, param).then(data => {
            return data.checkPass ? rawUser : Promise.reject('用户信息完整性校验失败');
        });
    }

    /**
     * 解密用户数据
     */
    decodeUserInfo(rawUser) {
        const url = `${this.baseUrl}/auth/decodeUserInfo`;
        const third_session = app.globalData.auth.third_session;
        const param = {
            encryptedData: rawUser.rawData,
            iv: rawUser.iv,
            sessionId: third_session,
            shop_code: app.globalData.shop.code
        };
        return Http.get(url, param).then(data => data);
    }



    /**
     * 检查微信登录状态
     */
    checkLoginStatus() {
        const user = wx.getStorageSync("user");
        if (user == "") {
            return Promise.reject('user不存在，尚未登录');
        }
        return wxApi.checkSession().then(res => user, err => err);
    }

    /**
     * 检查和服务器的会话
     */
    checkLoginCode() {
      const third_session =  wx.getStorageSync("third_session");
      if (third_session == '') {
          return Promise.reject('third_session 不存在');
        }

        const url = `${this.baseUrl}/auth/checkSession`;
        const param = { third_session: third_session };
        console.info('开始检查third_session', third_session);
        return Http.get(url, param).then(data => {
            if (data.appId) {
                //校验成功
              console.info('用户服务端登录状态third_session校验成功');
              wx.setStorageSync("shop_id", app.globalData.shop.code);
             
              this.saveAuthProperty('shop_id', app.globalData.shop.code);
              return third_session;
            }
            else {
                this.cleanLoginInfo();
                return Promise.reject('校验错误');
            }
        }, data => {
            this.cleanLoginInfo();
            return Promise.reject('third_session已过期');
        });
    }

    /**
     * 保存loginCode
     */
    saveAuthProperty(key, value) {
        app.globalData.auth[key] = value;
        wx.setStorageSync(key, value);
    }
    

    /**
     * 保存权限信息
     */
    saveAuthInfo(auth) {
        console.info('权限信息：', auth);
        this.saveAuthProperty('third_session', auth.third_session);
    }

    /**
     * 保存用户信息
     */
    saveUserInfo(user,login_code){
        console.info('用户信息', user);
        wx.setStorageSync('user', user);
        wx.setStorageSync('login_code', login_code);
        this.saveAuthProperty('login_code', login_code);
        app.globalData.user = user;
    }


    /**
     * 清理登录信息
     */
    cleanLoginInfo() {
        wx.removeStorageSync('user');
        wx.removeStorageSync('login_code');
        wx.removeStorageSync('third_session');
    }
} 