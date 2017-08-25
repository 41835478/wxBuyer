import BaseService from "./BaseService";
import Pagination from "../entity/Page";



/**
 * 订单服务类
 */
export default class OrderService extends BaseService {
    constructor() {
        super();
        //交易状态字典
        this.statusDict = {
            "0": "全部",
            "1": "等待买家付款",
            "2": "等待卖家发货",
            "3": "卖家已发货",
            "4": "等待买家评价",
            "5": "申请退款中",
            "6": "交易成功",
            "7": "交易关闭",
            "8": "卖家已退款"
        };
        //字符字典
        this.paymentDict = {
            "0": "线下支付",
            "1": "在线支付"
        };
        //订单配送方式
        this.deliveryText = {
            "SELF": "上门自提",
            "CITY": "同城配送",
            "EXPRESS": "快递配送"
        };

        this.statusDesc = {
            "1": "请于24小时内付款，超时订单自动关闭",
            "2": "您已完成付款，卖家准备发货中",
            "3": "请您耐心等待，到货后请确认收货",
            "4": "卖家已收到您的货款，请对本次交易进行评价",
            "5": "您已发起退款申请，等待卖家处理",
            "6": "交易已完成，卖家已收到您的货款",
            "7": "本交易已取消，欢迎您下次光临",
            "8": "货款已原路退回，请查收"
        }
    }


    /**
    * 返回分页对象
    */
    page() {
        const url = `${this.baseUrl}/orders`;
        return new Pagination(url, this._processOrderListItem.bind(this));
    }

    /**
     * 获取订单详情
     */
    getInfo(orderId) {
        const url = `${this.baseUrl}/orders/${orderId}`;
        return this.get(url, {}).then(detail => {
            this._processOrderDetail(detail);
            return detail;
        });
    }

    /**
     * 生成预支付订单
     */
    prepayOrder(orderId) {
        const url = `${this.baseUrl}/wxpay/orders/${orderId}`;
        return this.get(url, {});
    }

    /**
     * 拉起微信支付
     */
    wxpayOrder(payment) {
        return this.wxpay({
            'timeStamp': payment.timeStamp,
            'nonceStr': payment.nonceStr,
            'package': payment.package,
            'signType': 'MD5',
            'paySign': payment.paySign,
        });
    }

    /**
     * 创建订单
     */
    createOrder(trade, address) {
        const url = `${this.baseUrl}/orders`;
        this._processOrderAddress(trade, address);
        return this.post(url, trade);
    }

    /**
     * 申请退款
     */
    refundOrder(orderId, refund) {
        const url = `${this.baseUrl}/orders/${orderId}/status/refund`;
        return this.put(url, refund);
    }

    /**
     *  取消退款
     */
    cancelRefund(orderId, refundUuid) {
        const url = `${this.baseUrl}/orders/${orderId}/status/cancel_refund_money`;
        const param = {
            refundUuid: refundUuid
        };
        return this.put(url, param);
    }

    /**
     * 关闭订单
     */
    closeOrder(orderId) {
        const url = `${this.baseUrl}/orders/${orderId}/status/close`;
         const param = {
            note: '买家关闭'
        };
        return this.put(url, param);
    }

    /**
     * 确认收货
     */
    confirmOrder(orderId) {
        const url = `${this.baseUrl}/orders/${orderId}/status/comments`;
        return this.put(url);
    }

    /**
     * 评价订单
     */
    comment(orderId, comments) {
        const url = `${this.baseUrl}/comments`;
        return this.post(url, comments);
    }

    /**
     * 评价列表
     */
    commentList(goodsId) {
        const url = `${this.baseUrl}/comments`;
        return new Pagination(url, this._processGoodsComment.bind(this));
    }

    /**
     * 评价统计
     */
    commentCount(goodsId) {
        const url = `${this.baseUrl}/comments/count?goods_id=${goodsId}`;
        return this.get(url);
    }

    /**
     * 处理评价列表数据
     */
    _processGoodsComment(data) {
        const comment = {};
        comment.createTime = data.createTime ? data.createTime.substring(0, 10):'未知';
        comment.starArr = [0, 0, 0, 0, 0];
        for (let i = 0; i < data.star; i++) {
            comment.starArr[i] = 1;
        }
        comment.star = data.star;
        comment.avatar = data.customer.avatarUrl;
        comment.nickName = data.customer.nickName;
        comment.comment = data.comment;
        return comment;

    }



    /**
     * 计算支持的物流方式价格（根据商品信息及地址信息）
     */
    queryPostPrice(address, goodsList) {
        const url = `${this.baseUrl}/orders/delivery`;
        const param = {
            address: address,
            goodsList: goodsList
        };
        return this.post(url, param);
    }


    /*********************** 生成方法 ***********************/

    /**
     * 购物车下单
     */
    createCartTrade(goodsList) {
        const orderGoodsInfos = [];
        let price = 0;
        //根据购物车信息，构造订单的商品列表
        for (let i in goodsList) {
            const goods = goodsList[i];
            const info = {
                goodsId: goods.goodsId,
                goodsName: goods.goodsName,
                imageUrl: goods.goodsImage,
                goodsPrice: goods.goodsPrice,
                count: goods.goodsNum,
                skuText: goods.skuText,
                goodsSku: goods.goodsSku
            };
            orderGoodsInfos.push(info);
            price += goods.goodsPrice * goods.goodsNum;
        }
        //构造交易对象
        const trade = {
            dealPrice: price.toFixed(2),
            finalPrice: price.toFixed(2),
            paymentType: "1",
            paymentText: "在线支付",
            orderGoodsInfos: orderGoodsInfos,
            shopName: this.shopName
        };
        return trade;
    }


    /**
     * 构建一个交易对象（单个物品），商品页面直接下单
     */
    createSingleTrade(goods, num = 1, sku) {
        const imageUrl = this._processSingleOrderImageUrl(goods, sku);
        const skuText = this._processOrderSku(sku.skuText);
        const price = sku && sku.price ? sku.price : goods.sellPrice;
        const dealPrice = this._fixedPrice(price * num);
        const finalPrice = dealPrice;

        //构造交易对象
        const trade = {
            dealPrice: dealPrice,
            finalPrice: dealPrice,
            paymentType: "1",
            paymentText: "在线支付",
            orderGoodsInfos: [
                {
                    goodsId: goods.id,
                    goodsName: goods.name,
                    goodsSku: sku.skuText,
                    skuText: skuText,
                    imageUrl: imageUrl,
                    goodsPrice: price,
                    count: num,
                    innerCid:goods.innerCid
                }
            ],
            shopName: this.shopName
        };
        return trade;
    }


    /**
     * 根据订单构造退款对象
     */
    createOrderRefund(order) {
        return {
            orderId: order.orderId,
            uuid: order.uuid,
            type: 0,
            contactName: order.receiveName,
            contactPhone: order.receivePhone,
            price: order.finalPrice
        };
    }


    /**
     * 根据退款时间生成退款步骤
     */

    createOrderRefundSetps(refund) {
        let steps = [];

        //提交申请
        const creareTime = refund.createTime;
        if (creareTime) {
            steps.push(this._createRefundSetp('您的取消申请已提交，请耐心等待', creareTime));
            steps.push(this._createRefundSetp('等待卖家处理中,卖家24小时未处理将自动退款', creareTime));
        }

        //卖家处理
        const sellerTime = refund.sellerDealtime;
        if (sellerTime) {
            //卖家同意
            if (refund.isAgree == 1) {
                steps.push(this._createRefundSetp('卖家已同意退款', sellerTime));
                steps.push(this._createRefundSetp('款项已原路退回中，请注意查收', sellerTime));
            }
            //卖家不同意
            else {
                steps.push(this._createRefundSetp(`卖家不同意退款，原因：${refund.disagreeCause}`, sellerTime));

            }
        }

        //处理结束
        const finishTime = refund.finishTime;
        if (finishTime) {
            //卖家同意
            if (refund.isAgree == 1) {
                steps.push(this._createRefundSetp('退款成功', finishTime));
            }
            //卖家不同意
            else {
                steps.push(this._createRefundSetp('退款关闭，请联系卖家处理', finishTime));
            }
        }

        //买家关闭
        const closeTime = refund.closeTime;
        if (closeTime) {
            //卖家同意
            if (refund.isAgree == 2) {
                steps.push(this._createRefundSetp('退款关闭，请联系卖家处理', finishTime));
            }
            else if (refund.isAgree == 1) {
                //不需要
            }
            else {
                steps.push(this._createRefundSetp('买家取消退款，交易恢复', closeTime));
            }
        }


        //改变最后一个状态
        const lastStep = steps[steps.length - 1];
        lastStep.done = true;
        lastStep.current = true;

        //反转
        steps = steps.reverse();
        return steps;
    }

    _createRefundSetp(text, time) {
        return {
            text: text,
            timestape: time,
            done: false,
            current: false
        };
    }



    /*********************** 数据处理方法 ***********************/


    /**
     * 梳理订单图片（单独下单）
     */
    _processSingleOrderImageUrl(goods, seletedSku) {
        if (seletedSku && seletedSku.imageUrl) {
            return seletedSku.imageUrl;
        }
        else {
            const hasImage = goods.images && goods.images.length > 0;
            return hasImage ? goods.images[0].url : null;
        }
    }



    /**
     * 处理订单地址
     */
    _processOrderAddress(order, address) {
        order.receiveName = address.name;
        order.receivePhone = address.phone;
        order.address = address.fullAddress;
    }


    /**
     * 处理订单列表数据
     */
    _processOrderListItem(order) {
        const status = order.status;
        order.statusText = this.statusDict[status];
        //动作控制 待付款/待评论/待收货/待发货（线下）
        order.isAction = status == 1 || status == 3 || status == 4;
        if(order.paymentType == 0 && order.status == 2){
            order.isAction = true;
        }

        order.shopName = this.shopName;
        //处理订单价格
        this._processOrderPrice(order);
        //处理商品信息
        const goods = order.orderGoodsInfos;
        this._processOrderGoods(goods);
    }

    /**
     * 处理订单详情
     */
    _processOrderDetail(detail) {

        //支付方式
        detail.shopName = this.shopName;
        //处理订单支付方式
        this._processOrderPaymentText(detail);
        //处理订单状态
        this._processOrderStatusDesc(detail);
        //处理退款信息
        this._processOrderRefund(detail);
        //处理物流信息
        this._processOrderTrace(detail);
        //处理订单配送方式
        this._processOrderDetailDelivery(detail);
        //处理订单价格
        this._processOrderPrice(detail);
        //处理商品信息
        this._processOrderGoods(detail.orderGoodsInfos);

    }

    /**
     * 处理订单支付方式
     */
    _processOrderPaymentText(detail) {
        detail.paymentText = this.paymentDict[detail.paymentType];
    }

    /**
     * 处理订单状态
     */
    _processOrderPrice(order) {
        order.postFee = this._fixedPrice(order.postFee);
        order.dealPrice = this._fixedPrice(order.dealPrice);
        order.finalPrice = this._fixedPrice(order.finalPrice);
        order.couponPrice = this._fixedPrice(order.couponPrice);
    }

    _fixedPrice(price) {
        if (price == null || isNaN(Number(price))) {
            return null;
        }
        return price.toFixed(2);
    }

    /**
     * 处理状态描述文本
     */
    _processOrderStatusDesc(order) {
        const status = order.status;
        order.statusText = this.statusDict[status];
        order.statusDesc = this.statusDesc[status];
        order.isAction = status == 1 || status == 2 || status == 3 || status == 4;
    }


    /**
     * 处理物流配送信息
     */
    _processOrderDetailDelivery(order) {
        const type = this.deliveryText[order.deliveryType];
        //const price = order.postFee == 0 ? '免邮' : '￥' + order.postFee;
        order.deliveryText = type;
    }


    /**
     * 处理商品物流信息
     */
    _processOrderTrace(order) {
        const express = order.orderExpress;
        if (express == null) {
            //没有物流信息，不做处理
            return;
        }

        //有物流，就一定需要展现动作列表
        order.isAction = true;
        order.isExpress = true;
    }


    /**
     * 处理订单的退货信息
     */
    _processOrderRefund(order) {
        const refunds = order.orderRefunds;
        if (refunds == null || refunds.length < 1) {
            //订单没有退款信息，不做处理
            return;
        }
        //展现第一个退款记录
        const refund = refunds[refunds.length - 1];
        //曾经退款过，就一定需要展现退款记录
        order.isAction = true;
        //控制展现退款详情字段
        order.isRefund = true;
        //取出第一条退款记录
        order.curRefund = refund;
    }


    /**
     * 处理订单商品信息
     */
    _processOrderGoods(goods) {
        goods.forEach(item => {
            item.imageUrl += '/small';
        });
        if (goods == null || goods.length < 1) {
            return;
        }
        goods.forEach(item => {
            //处理SKU描述
            const sku = item.goodsSku;
            const skuText = this._processOrderSku(sku);
            item.skuText = skuText;
        });

        
    }

    /**
     * 处理SKU的默认值
     */

    _processOrderSku(goodsSku) {
        let skuText = "";
        if (goodsSku && goodsSku != '') {
            skuText = goodsSku.replace(/:/g, ',');
        }
        return skuText;
    }
}


